import { certs } from "../data/profile.ts";

export const ROOM_W = 384;
export const ROOM_H = 216;
export const FLOOR_Y = 184;
export const HERO_W = 16;
export const HERO_H = 24;
export const MIN_X = HERO_W / 2;
export const MAX_X = ROOM_W - HERO_W / 2;
/** Extra reach beyond a station's edge that still counts as "near". */
export const REACH = 10;

export interface Station {
  id: string;
  x: number;
  w: number;
  label: string;
  sprite: string;
  /** Station width equals its sprite width. Sprite height, and px it hangs above the floor line (wall decor). */
  h: number;
  lift?: number;
}

export const STATIONS: readonly Station[] = [
  { id: "about", x: 24, w: 24, label: "Player card", sprite: "frame", h: 28, lift: 56 },
  { id: "work", x: 76, w: 32, label: "Quest log", sprite: "rack", h: 56 },
  { id: "certs", x: 130, w: 48, label: `Achievements ${certs.length}/${certs.length}`, sprite: "shelf", h: 44 },
  { id: "tools", x: 198, w: 48, label: "Inventory", sprite: "bench", h: 40 },
  { id: "off-duty", x: 262, w: 64, label: "Off duty", sprite: "couch", h: 40 },
  { id: "contact", x: 342, w: 24, label: "Mailbox", sprite: "mailbox", h: 40 },
];

export const clampX = (x: number): number => Math.min(MAX_X, Math.max(MIN_X, x));

export const stationById = (id: string): Station | undefined => STATIONS.find((s) => s.id === id);

export const stationCenter = (s: Station): number => s.x + s.w / 2;

/** Closest station whose reach covers hero x, or null. */
export function nearestStation(x: number): Station | null {
  let best: Station | null = null;
  let bestD = Infinity;
  for (const s of STATIONS) {
    const d = Math.abs(x - stationCenter(s));
    if (d <= s.w / 2 + REACH && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

const HIT_SLOP = 2;

/** Station whose own sprite box contains the world-space point, or null (floor, gaps, wall). */
export function hitStation(x: number, y: number): Station | null {
  for (const s of STATIONS) {
    const bottom = FLOOR_Y - (s.lift ?? 0);
    if (x >= s.x - HIT_SLOP && x <= s.x + s.w + HIT_SLOP && y >= bottom - s.h - HIT_SLOP && y <= bottom + HIT_SLOP) return s;
  }
  return null;
}

/** Integer room-px scale from the wrap height; the camera is needed when the width can't show the whole room. */
export function pickScale(wrapW: number, wrapH: number, dpr: number): { scale: number; camera: boolean } {
  const scale = Math.max(1, Math.floor((wrapH * dpr) / ROOM_H));
  return { scale, camera: scale * ROOM_W > wrapW * dpr };
}

/** Left edge of the visible slice (viewW room px wide) following the hero, clamped to the room. */
export const cameraX = (heroX: number, viewW: number): number =>
  Math.round(Math.min(Math.max(0, ROOM_W - viewW), Math.max(0, heroX - viewW / 2)));
