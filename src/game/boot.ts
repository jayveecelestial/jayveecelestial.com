import { createInput } from "./input.ts";
import { bubbleText, createRenderer } from "./render.ts";
import { initialState, resolveMode, update } from "./state.ts";
import { stationById } from "./world.ts";

const MODE_KEY = "ng-mode";
const TUTORIAL_KEY = "ng-tutorial";
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
    toggle.textContent = plain ? "Play mode" : "Plain view";
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
  const renderer = createRenderer(canvas, wrap);
  const blocked = () => panel.open || (!reduced && !raf);
  const input = createInput(canvas, blocked, renderer.view, !reduced);
  let state = initialState();
  let onscreen = true;
  let raf = 0;
  let last = 0;
  let acc = 0;

  // ---- panel ----
  let opened: { node: HTMLElement; next: Node | null; trigger: HTMLElement | null } | null = null;

  /** Phone Close sits exactly on the Open button. No touchpad (reduced motion): CSS falls back to bottom centre. */
  const placeClose = () => {
    const r = $("#touchpad [data-act]")?.getBoundingClientRect();
    const st = panel.style;
    if (!panel.open || !r || !r.width) {
      for (const k of ["x", "y", "w", "h", "pad"]) st.removeProperty(`--close-${k}`);
      return;
    }
    st.setProperty("--close-x", `${r.left}px`);
    st.setProperty("--close-y", `${r.top}px`);
    st.setProperty("--close-w", `${r.width}px`);
    st.setProperty("--close-h", `${r.height}px`);
    st.setProperty("--close-pad", `${window.innerHeight - r.top + 16}px`);
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
      if (!on) store.set(TUTORIAL_KEY, "1");
    };
    show(!store.get(TUTORIAL_KEY));
    tutorial.querySelector("[data-tutorial-close]")?.addEventListener("click", () => show(false));
    $("#help")?.addEventListener("click", () => show(tutorial.hidden));
  }

  // ---- loop ----
  const draw = () =>
    renderer.draw(state, {
      animate: !reduced,
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

  if (reduced) {
    // One static frame; pointer picks open instantly (input.ts has queued the target).
    canvas.addEventListener("pointerdown", () => {
      const t = input.poll().target;
      if (t) openStation(t);
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
      if (state.open) {
        openStation(state.open);
        break;
      }
    }
    draw();
    if (shouldRun() && !raf) raf = requestAnimationFrame(frame);
  };

  const shouldRun = () => !reduced && onscreen && !document.hidden && !panel.open;

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
  new ResizeObserver(() => {
    renderer.resize();
    draw();
  }).observe(wrap);
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
}

boot();
