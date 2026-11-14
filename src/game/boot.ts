import { createInput } from "./input.ts";
import { bubbleText, createRenderer } from "./render.ts";
import { QUEST, announcement, isComplete, isQuestId, markDone, parseStored, shouldShowBanner, type QuestId } from "./quest.ts";
import { NO_INPUT, initialState, resolveMode, update } from "./state.ts";
import { stationById } from "./world.ts";

const MODE_KEY = "ng-mode";
const TUTORIAL_KEY = "ng-tutorial";
const QUEST_KEY = "ng-quest";
const SEEN_KEY = "ng-quest-seen";
const STEP = 1 / 60;

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage blocked: choice just won't persist */
    }
  },
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);

function boot() {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  if (view === "plain" || view === "play") store.set(MODE_KEY, view);
  const plain = resolveMode(view, store.get(MODE_KEY)) === "plain";

  const toggle = $<HTMLAnchorElement>("#mode-toggle");
  if (toggle) {
    toggle.textContent = plain ? "Play mode" : "Just the CV";
    toggle.href = plain ? "/" : "?view=plain#about";
    toggle.addEventListener("click", () => store.set(MODE_KEY, plain ? "play" : "plain"));
  }

  const canvas = $<HTMLCanvasElement>("#stage");
  const wrap = $("#stage-wrap");
  const panel = $<HTMLDialogElement>("#panel");
  const live = $("#live");
  if (plain || !canvas || !wrap || !panel || !canvas.getContext?.("2d")) return;

  document.documentElement.classList.add("game");

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Touch: coarse pointer, no hover, or touch points with no fine pointer; a first touch pointerdown also flips it.
  let touch =
    matchMedia("(pointer: coarse)").matches ||
    matchMedia("(hover: none)").matches ||
    (navigator.maxTouchPoints > 0 && !matchMedia("(any-pointer: fine)").matches);
  let fontOk = false;
  const hud = $("#hud");
  // Same queries as global.css where the room is bottom-aligned; elsewhere the room is centred and the HUD floats clear of it.
  const bottomAligned = "(max-width: 640px), (max-height: 480px) and (orientation: landscape)";
  const renderer = createRenderer(canvas, wrap, () =>
    matchMedia(bottomAligned).matches
      ? Math.max(0, (hud?.getBoundingClientRect().bottom ?? 0) - wrap.getBoundingClientRect().top)
      : 0,
  );
  const blocked = () => panel.open || !!doneDlg?.open || (!reduced && !raf);
  const input = createInput(canvas, blocked, renderer.view, !reduced);
  let state = initialState();
  let onscreen = true;
  let raf = 0;
  let last = 0;
  let acc = 0;

  // ---- quest: open Work, Trophies and Mailbox ----
  const tracker = $("#quest");
  const doneDlg = $<HTMLDialogElement>("#quest-done");
  let done: readonly QuestId[] = parseStored(store.get(QUEST_KEY));
  let showDoneAfterClose = false;
  /** #live is inert while a modal is open, so announcements wait for the panel to close. */
  let pendingMsg = "";

  const renderQuest = () => {
    if (!tracker) return;
    tracker.hidden = false;
    tracker.classList.toggle("complete", isComplete(done));
    const count = $("#quest-count");
    if (count) count.textContent = `${done.length}/${QUEST.length}`;
    tracker.querySelectorAll<HTMLElement>("[data-quest]").forEach((li) => {
      const ok = done.includes(li.dataset.quest as QuestId);
      li.classList.toggle("done", ok);
      const state = li.querySelector(".q-state");
      if (state) state.textContent = ok ? "done" : "to do";
    });
  };

  const showDone = () => {
    if (!doneDlg || doneDlg.open) return;
    store.set(SEEN_KEY, "1");
    doneDlg.showModal();
    sync();
  };
  doneDlg?.addEventListener("close", () => sync());

  const questOpened = (id: string) => {
    if (!isQuestId(id)) return;
    const next = markDone(done, id);
    if (next === done) return;
    done = next;
    store.set(QUEST_KEY, JSON.stringify(done));
    renderQuest();
    pendingMsg = announcement(done, id);
    if (isComplete(done)) showDoneAfterClose = true;
  };

  // Back to the game: focus on body so walking works at once; the close event resumes the loop.
  doneDlg?.querySelector("[data-quest-explore]")?.addEventListener("click", () => {
    doneDlg.close();
    (document.activeElement as HTMLElement | null)?.blur();
  });

  // Tracker: collapsed on small screens, open otherwise; the toggle overrides until the screen class changes.
  const qToggle = $("#quest-toggle");
  const qList = $("#quest-list");
  if (qToggle && qList) {
    const setOpen = (open: boolean) => {
      qToggle.setAttribute("aria-expanded", String(open));
      qList.hidden = !open;
    };
    const small = matchMedia("(max-width: 640px), (max-height: 480px)");
    setOpen(!small.matches);
    small.addEventListener("change", (e) => setOpen(!e.matches));
    qToggle.addEventListener("click", () => setOpen(qToggle.getAttribute("aria-expanded") !== "true"));
  }
  renderQuest();

  // ---- panel ----
  let opened: { node: HTMLElement; next: Node | null; trigger: HTMLElement | null } | null = null;

  /** Phone Close sits exactly on the Open button. No touchpad (reduced motion): CSS falls back to bottom centre. */
  const placeClose = () => {
    const r = $("#touchpad [data-act]")?.getBoundingClientRect();
    const st = panel.style;
    if (!panel.open || !r || !r.width) {
      for (const k of ["x", "y", "w", "h"]) st.removeProperty(`--close-${k}`);
      st.removeProperty("--scroll-bottom");
      return;
    }
    st.setProperty("--close-x", `${r.left}px`);
    st.setProperty("--close-y", `${r.top}px`);
    st.setProperty("--close-w", `${r.width}px`);
    st.setProperty("--close-h", `${r.height}px`);
    st.setProperty("--scroll-bottom", `${window.innerHeight - r.top + 8}px`);
  };
  window.addEventListener("resize", placeClose);

  /** `from` = the nav link that opened it; focus returns there on close. Game opens leave focus alone. */
  const openStation = (id: string, from: HTMLElement | null = null) => {
    const node = document.getElementById(id);
    if (!node || panel.open) return;
    opened = {
      node,
      next: node.nextSibling,
      trigger: from,
    };
    panel.setAttribute("aria-labelledby", `${id}-title`);
    panel.append(node);
    panel.showModal();
    questOpened(id);
    placeClose();
    document.getElementById(`${id}-title`)?.focus();
    sync();
  };

  panel.addEventListener("close", () => {
    if (!opened) return;
    const { node, next, trigger } = opened;
    opened = null;
    placeClose();
    $("#sections")?.insertBefore(node, next);
    panel.removeAttribute("aria-labelledby");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    trigger?.focus();
    sync();
    if (live && pendingMsg) live.textContent = pendingMsg;
    pendingMsg = "";
    if (showDoneAfterClose) {
      showDoneAfterClose = false;
      showDone();
    }
  });
  panel.querySelector("[data-close]")?.addEventListener("click", () => panel.close());

  const fromHash = () => {
    const id = location.hash.slice(1);
    if (id && stationById(id)) openStation(id);
  };
  addEventListener("hashchange", fromHash);

  $("#stations")?.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLElement>("[data-station]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as MouseEvent).button !== 0) return;
    e.preventDefault();
    openStation(a.dataset.station!, a);
  });

  // ---- tutorial ----
  let applyTouch = () => {};
  addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || touch) return;
    touch = true;
    applyTouch();
    draw();
  });
  const tutorial = $("#tutorial");
  if (tutorial) {
    const keysEl = tutorial.querySelector<HTMLElement>("[data-tutorial-keys]");
    const touchEl = tutorial.querySelector<HTMLElement>("[data-tutorial-touch]");
    // No keys without a loop (reduced motion), so show the pointer text there too.
    applyTouch = () => {
      const pointer = touch || reduced;
      if (keysEl) keysEl.hidden = pointer;
      if (touchEl) touchEl.hidden = !pointer;
    };
    applyTouch();
    const show = (on: boolean) => {
      tutorial.hidden = !on;
      document.documentElement.classList.toggle("tutorial-open", on);
      if (!on) store.set(TUTORIAL_KEY, "1");
    };
    show(!store.get(TUTORIAL_KEY));
    tutorial.querySelector("[data-tutorial-close]")?.addEventListener("click", () => show(false));
    $("#help")?.addEventListener("click", () => show(tutorial.hidden));
  }

  // ---- loop ----
  /** performance.now() when the sign lit, for the short buzz. */
  let litAt = 0;
  const BUZZ_MS = 1000;
  const BUZZ_STEP_MS = 80;
  const buzzing = () => {
    if (reduced || !state.lit) return false;
    const since = performance.now() - litAt;
    return since < BUZZ_MS && Math.floor(since / BUZZ_STEP_MS) % 2 === 1;
  };
  const draw = () =>
    renderer.draw(state, {
      animate: !reduced,
      lit: state.lit,
      buzz: buzzing(),
      bubble:
        fontOk && state.near && !panel.open
          ? bubbleText(state.near, reduced ? (touch ? "poke" : "click") : touch ? "tap" : "key")
          : null,
    });

  let lastNear: string | null = state.near;
  let lastSpoken = 0;
  const announce = () => {
    if (state.near === lastNear) return;
    lastNear = state.near;
    const now = performance.now();
    if (!live || !state.near || !input.keyboard || now - lastSpoken < 1000) return;
    lastSpoken = now;
    live.textContent = `${stationById(state.near)?.label}. Press E to open.`;
  };

  /** Announce once when the sign flips to lit. */
  let wasLit = state.lit;
  const noteLit = () => {
    if (state.lit === wasLit) return;
    wasLit = state.lit;
    litAt = performance.now();
    if (live && state.lit) live.textContent = "SHIP IT sign lit";
  };

  if (reduced) {
    // One static frame; pointer picks open instantly (input.ts has queued the target).
    // No loop, so state.t is frozen: advance it by real time on each poke so 3 taps in 2 s still count.
    let lastPoke = performance.now();
    canvas.addEventListener("pointerdown", () => {
      const i = input.poll();
      if (i.target) openStation(i.target);
      if (i.poke) {
        const now = performance.now();
        state = update(state, { ...NO_INPUT, poke: true }, (now - lastPoke) / 1000);
        lastPoke = now;
        noteLit();
        draw();
      }
    });
  }

  // ---- touchpad: hold-to-walk and Open; never takes focus ----
  const pad = $("#touchpad");
  pad?.addEventListener("contextmenu", (e) => e.preventDefault());
  pad?.querySelectorAll<HTMLElement>("[data-move], [data-act]").forEach((btn) => {
    const dir = btn.dataset.move as "left" | "right" | undefined;
    const release = () => dir && input.press(dir, false);
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (reduced || blocked()) return;
      if (dir) {
        btn.setPointerCapture(e.pointerId);
        input.press(dir, true);
      } else if (!state.near) {
        if (live) live.textContent = "Walk to an object";
      } else {
        input.act();
      }
    });
    for (const ev of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) btn.addEventListener(ev, release);
  });

  const frame = (now: number) => {
    raf = 0;
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      state = update(state, input.poll(), STEP);
      acc -= STEP;
      announce();
      noteLit();
      if (state.open) {
        openStation(state.open);
        break;
      }
    }
    draw();
    if (shouldRun() && !raf) raf = requestAnimationFrame(frame);
  };

  const shouldRun = () => !reduced && onscreen && !document.hidden && !panel.open && !doneDlg?.open;

  function sync() {
    const run = shouldRun();
    if (run && !raf) {
      input.reset();
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  document.addEventListener("visibilitychange", sync);
  new IntersectionObserver(([e]) => {
    onscreen = e.isIntersecting;
    sync();
  }).observe(wrap);
  const resizeObs = new ResizeObserver(() => {
    renderer.resize();
    draw();
  });
  // HUD height changes (font load, wrapping) move reserveTop; canvas resizes never change the HUD, so no loop.
  resizeObs.observe(wrap);
  if (hud) resizeObs.observe(hud);
  // The bubble waits for its font so it never flashes in the fallback.
  Promise.resolve(document.fonts?.load('700 14px "Red Hat Display"'))
    .catch(() => {})
    .then(() => {
      fontOk = true;
      renderer.resize();
      draw();
    });

  draw();
  sync();
  fromHash();
  if (shouldShowBanner(done, store.get(SEEN_KEY) === "1")) showDone();
}

boot();
