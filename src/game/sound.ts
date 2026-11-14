import { isComplete, markDone, type QuestId } from "./quest.ts";

export type SfxName = "jump" | "open" | "task" | "complete";

type Tone = { type: OscillatorType; from: number; to?: number; ms: number };

/** Peak gain stays low: these are accents, not music. */
export const PEAK_GAIN = 0.06;

export const SFX: Record<SfxName, readonly Tone[]> = {
  jump: [{ type: "square", from: 300, to: 600, ms: 80 }],
  open: [
    { type: "triangle", from: 660, ms: 60 },
    { type: "triangle", from: 990, ms: 60 },
  ],
  task: [523, 659, 784].map((from) => ({ type: "square", from, ms: 70 })),
  complete: [523, 659, 784, 1047].map((from) => ({ type: "square", from, ms: 110 })),
};

export const parsePref = (raw: string | null): boolean => raw === "on";

/** Sound for a quest step: one per new task, a fanfare for the last, silence for repeats and non-quest ids. */
export function sfxForQuest(done: readonly QuestId[], id: string): "task" | "complete" | null {
  const next = markDone(done, id);
  if (next === done) return null;
  return isComplete(next) ? "complete" : "task";
}

/** `gesture`: true when called from a click handler, so audio unlocks at once; otherwise on the next click, touchend or keydown. */
export type Sound = { enable(gesture?: boolean): void; disable(): void; play(name: SfxName): void };

/** Test seams: all default to the browser. */
export type SoundEnv = {
  make?: () => AudioContext;
  hidden?: () => boolean;
  target?: EventTarget;
  doc?: EventTarget;
};

const UNLOCK_EVENTS = ["click", "touchend", "keydown"] as const;

/**
 * The AudioContext is made lazily, only inside a user gesture (browsers keep it suspended otherwise).
 * iOS Safari unlocks only on click, touchend and keydown, so the listeners stay armed until the context is running,
 * and re-arm when it is suspended or interrupted again, or the tab returns.
 */
export function createSound(env: SoundEnv = {}): Sound {
  const target = env.target ?? window;
  const doc = env.doc ?? document;
  const hidden = env.hidden ?? (() => document.hidden);
  const make =
    env.make ??
    (() => {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return new Ctor();
    });
  let on = false;
  let ctx: AudioContext | null = null;

  const arm = () => {
    for (const type of UNLOCK_EVENTS) target.addEventListener(type, unlock);
  };
  const disarm = () => {
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, unlock);
  };

  async function unlock() {
    if (!on) return;
    if (!ctx) {
      try {
        ctx = make();
      } catch {
        disarm();
        return;
      }
      const c = ctx;
      c.onstatechange = () => {
        if (on && c.state !== "running") arm();
      };
    }
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    if (ctx.state === "running") disarm();
  }

  doc.addEventListener("visibilitychange", () => {
    if (on && !hidden() && ctx?.state !== "running") arm();
  });

  return {
    enable(inGesture = false) {
      on = true;
      arm();
      if (inGesture) void unlock();
    },
    disable() {
      on = false;
      disarm();
      void ctx?.suspend().catch(() => {});
    },
    play(name) {
      if (!on || hidden()) return;
      const c = ctx;
      if (!c || c.state !== "running") return;
      let t = c.currentTime;
      for (const tone of SFX[name]) {
        const dur = tone.ms / 1000;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = tone.type;
        osc.frequency.setValueAtTime(tone.from, t);
        if (tone.to) osc.frequency.linearRampToValueAtTime(tone.to, t + dur);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(PEAK_GAIN, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(c.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur;
      }
    },
  };
}
