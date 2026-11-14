import { NO_INPUT, type Input } from "./state.ts";
import { ROOM_H, hitStation } from "./world.ts";

const KEYMAP: Record<string, "left" | "right" | "jump" | "act"> = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowUp: "jump",
  w: "jump",
  W: "jump",
  " ": "jump",
  ArrowDown: "act",
  e: "act",
  E: "act",
  Enter: "act",
};

/** Focus here swallows every key. */
const TEXT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
/** Focus here only keeps Enter/Space, which activate it. */
const ACTIVATE_TAGS = new Set(["A", "BUTTON", "SUMMARY"]);

export interface InputSource {
  /** Snapshot for this step; one-shot fields are cleared. */
  poll(): Input;
  /** Drop held keys and queued one-shots (on resume). */
  reset(): void;
  /** True if the last interaction was the keyboard (gates announcements). */
  readonly keyboard: boolean;
}

export interface View {
  camX: number;
  viewW: number;
}

export function createInput(
  canvas: HTMLCanvasElement,
  isBlocked: () => boolean,
  view: () => View,
  keys = true,
): InputSource {
  const held = new Set<string>();
  let once: Input = { ...NO_INPUT };
  let keyboard = false;

  const swallowed = (key: string) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    if (TEXT_TAGS.has(el.tagName) || el.isContentEditable) return true;
    return ACTIVATE_TAGS.has(el.tagName) && (key === "Enter" || key === " ");
  };

  const down = (e: KeyboardEvent) => {
    const k = KEYMAP[e.key];
    if (!k || e.ctrlKey || e.metaKey || e.altKey || isBlocked() || swallowed(e.key)) return;
    e.preventDefault();
    keyboard = true;
    if (k === "act" || k === "jump") {
      if (!e.repeat) once = { ...once, [k]: true };
    } else held.add(k);
  };
  const up = (e: KeyboardEvent) => {
    const k = KEYMAP[e.key];
    if (k) held.delete(k);
  };
  const click = (e: PointerEvent) => {
    if (isBlocked()) return;
    const r = canvas.getBoundingClientRect();
    const v = view();
    const x = v.camX + ((e.clientX - r.left) / r.width) * v.viewW;
    const y = ((e.clientY - r.top) / r.height) * ROOM_H;
    keyboard = false;
    const hit = hitStation(x, y);
    once = hit ? { ...once, target: hit.id } : { ...once, walkTo: x };
  };

  if (keys) {
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("blur", () => held.clear());
  }
  canvas.addEventListener("pointerdown", click);

  return {
    get keyboard() {
      return keyboard;
    },
    poll() {
      const out: Input = { ...once, left: held.has("left"), right: held.has("right") };
      once = { ...NO_INPUT };
      return out;
    },
    reset() {
      held.clear();
      once = { ...NO_INPUT };
    },
  };
}
