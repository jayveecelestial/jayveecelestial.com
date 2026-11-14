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
  const touch = matchMedia("(pointer: coarse)").matches;
  const renderer = createRenderer(canvas, wrap);
  const input = createInput(canvas, () => panel.open || (!reduced && !raf), renderer.view, !reduced);
  let state = initialState();
  let onscreen = true;
  let raf = 0;
  let last = 0;
  let acc = 0;

  // ---- panel ----
  let opened: { node: HTMLElement; next: Node | null; trigger: HTMLElement | null } | null = null;

  const openStation = (id: string) => {
    const node = document.getElementById(id);
    if (!node || panel.open) return;
    const active = document.activeElement as HTMLElement | null;
    opened = {
      node,
      next: node.nextSibling,
      trigger: active && active !== document.body ? active : $(`[data-station="${id}"]`),
    };
    panel.setAttribute("aria-labelledby", `${id}-title`);
    panel.append(node);
    panel.showModal();
    document.getElementById(`${id}-title`)?.focus();
    sync();
  };

  panel.addEventListener("close", () => {
    if (!opened) return;
    const { node, next, trigger } = opened;
    opened = null;
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
    openStation(a.dataset.station!);
  });

  // ---- tutorial ----
  const tutorial = $("#tutorial");
  if (tutorial) {
    const keysEl = tutorial.querySelector<HTMLElement>("[data-tutorial-keys]");
    const touchEl = tutorial.querySelector<HTMLElement>("[data-tutorial-touch]");
    // No keys without a loop (reduced motion), so show the pointer text there too.
    const pointer = touch || reduced;
    if (keysEl) keysEl.hidden = pointer;
    if (touchEl) touchEl.hidden = !pointer;
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
      bubble: state.near && !panel.open ? bubbleText(state.near, reduced ? "click" : touch ? "tap" : "key") : null,
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
  document.fonts?.ready.then(() => {
    renderer.resize();
    draw();
  });

  draw();
  sync();
  fromHash();
}

boot();
