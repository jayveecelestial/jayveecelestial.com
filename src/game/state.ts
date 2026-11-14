import { clampX, nearestStation, stationById, stationCenter } from "./world.ts";

export const SPEED = 72;
export const AUTO_SPEED = 160;
export const JUMP_V = 150;
export const GRAVITY = 520;

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  /** Enter / E / Down pressed this frame. */
  act: boolean;
  /** Pointer picked a station: walk there, then open. */
  target: string | null;
  /** Pointer picked empty floor: walk to this x. */
  walkTo: number | null;
}

export interface State {
  /** Hero centre x in room px. */
  x: number;
  /** Height above floor in px. */
  y: number;
  vy: number;
  facing: 1 | -1;
  walking: boolean;
  /** Station id being auto-walked to. */
  target: string | null;
  /** Auto-walk destination x. */
  goal: number | null;
  /** Nearest station id in reach. */
  near: string | null;
  /** Station id to open this step (one-shot). */
  open: string | null;
  /** Seconds elapsed, drives animation. */
  t: number;
}

export const NO_INPUT: Input = { left: false, right: false, jump: false, act: false, target: null, walkTo: null };

export const initialState = (): State => ({
  x: 40,
  y: 0,
  vy: 0,
  facing: 1,
  walking: false,
  target: null,
  goal: null,
  near: nearestStation(40)?.id ?? null,
  open: null,
  t: 0,
});

export function update(s: State, input: Input, dt: number): State {
  let target = s.target;
  let goal = s.goal;
  if (input.target && stationById(input.target)) {
    target = input.target;
    goal = stationCenter(stationById(target)!);
  } else if (input.walkTo !== null) {
    target = null;
    goal = clampX(input.walkTo);
  }
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let x = s.x;
  let facing = s.facing;
  let open: string | null = null;

  if (dir !== 0) {
    target = null;
    goal = null;
    facing = dir > 0 ? 1 : -1;
    x = clampX(x + dir * SPEED * dt);
  } else if (goal !== null) {
    const gap = goal - x;
    const step = AUTO_SPEED * dt;
    if (Math.abs(gap) <= step) {
      x = goal;
      open = target;
      target = null;
      goal = null;
    } else {
      facing = gap > 0 ? 1 : -1;
      x += Math.sign(gap) * step;
    }
  }

  let y = s.y;
  let vy = s.vy;
  if (input.jump && y === 0) vy = JUMP_V;
  if (vy !== 0 || y > 0) {
    vy -= GRAVITY * dt;
    y += vy * dt;
    if (y <= 0) {
      y = 0;
      vy = 0;
    }
  }

  const near = nearestStation(x)?.id ?? null;
  if (input.act && near && !open) open = near;

  return { x, y, vy, facing, walking: x !== s.x, target, goal, near, open, t: s.t + dt };
}

export type Mode = "plain" | "play";

/** ?view=plain|play wins over the stored choice; anything else is ignored. */
export const resolveMode = (view: string | null, stored: string | null): Mode =>
  view === "plain" || view === "play" ? view : stored === "plain" ? "plain" : "play";
