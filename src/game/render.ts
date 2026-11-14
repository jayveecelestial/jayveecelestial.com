import type { View } from "./input.ts";
import { PALETTE_KEYS, SPRITES } from "./sprites.ts";
import type { State } from "./state.ts";
import { FLOOR_Y, HERO_H, HERO_W, ROOM_H, ROOM_W, STATIONS, cameraX, pickScale, stationById, stationCenter } from "./world.ts";

export interface DrawOptions {
  /** Speech bubble text for the nearest station, or null. */
  bubble: string | null;
  /** False = static frame (reduced motion): no blink, bob or arrow bounce. */
  animate: boolean;
}

export interface Renderer {
  /** Re-fit to the wrap; the next draw repaints. */
  resize(): void;
  draw(s: State, o: DrawOptions): void;
  /** Camera and visible width in room px, as last drawn. */
  view(): View;
}

const FONT_FAMILY = '"Red Hat Display", system-ui, sans-serif';
/** Bubble text size and padding in css px; drawn at device resolution, not in the pixel buffer. */
const TEXT_PX = 14;
const MIN_TEXT_PX = 12;
const PAD_PX = 8;
/** Optional upper-wall decor: sprite name, centre x, centre y. Skipped when absent. */
const DECOR: [string, number, number][] = [
  ["poster", 88, 48],
  ["clock", 152, 40],
  ["neon", 312, 44],
];

/** key = keyboard, tap = touchpad Open button, click = mouse in reduced motion, poke = tap on the object in reduced motion. */
export type BubbleMode = "key" | "tap" | "click" | "poke";

const VERB: Record<BubbleMode, string> = { key: "Press E", tap: "Tap Open", click: "Click", poke: "Tap" };

export const bubbleText = (id: string, mode: BubbleMode): string => `${VERB[mode]}: ${stationById(id)?.label ?? ""}`;

export function createRenderer(canvas: HTMLCanvasElement, wrap: HTMLElement, reserveTop: () => number = () => 0): Renderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const css = getComputedStyle(document.documentElement);
  const col = (v: string) => css.getPropertyValue(v).trim();
  const c = { bg: col("--bg"), brick: col("--brick"), muted: col("--muted"), panel: col("--panel") };

  const pal: Record<string, string> = {};
  for (const [ch, v] of Object.entries(PALETTE_KEYS)) pal[ch] = col(v);

  const layer = (w: number, h: number) => {
    const el = document.createElement("canvas");
    el.width = w;
    el.height = h;
    return el;
  };

  const baked: Record<string, HTMLCanvasElement[]> = {};
  for (const [name, spr] of Object.entries(SPRITES)) {
    baked[name] = spr.frames.map((rows) => {
      const el = layer(spr.w, spr.h);
      const g = el.getContext("2d")!;
      rows.forEach((row, y) => {
        for (let x = 0; x < spr.w; x++) {
          const fill = pal[row[x]];
          if (fill) {
            g.fillStyle = fill;
            g.fillRect(x, y, 1, 1);
          }
        }
      });
      return el;
    });
  }

  const put = (g: CanvasRenderingContext2D, name: string, frame: number, x: number, y: number, flip = false) => {
    const frames = baked[name];
    if (!frames) return;
    const img = frames[frame % frames.length];
    g.save();
    g.translate(Math.round(x) + (flip ? img.width : 0), Math.round(y));
    if (flip) g.scale(-1, 1);
    g.drawImage(img, 0, 0);
    g.restore();
  };
  const dims = (name: string) => baked[name][0];

  // Static room (wall, window, decor, floor) painted once.
  const bg = layer(ROOM_W, ROOM_H);
  {
    const g = bg.getContext("2d")!;
    g.fillStyle = c.brick;
    g.fillRect(0, 0, ROOM_W, FLOOR_Y);
    const b = dims("brick");
    for (let y = 0; y < FLOOR_Y; y += b.height) for (let x = 0; x < ROOM_W; x += b.width) put(g, "brick", 0, x, y);
    put(g, "window", 0, 238 - dims("window").width / 2, 24);
    for (const [name, cx, cy] of DECOR) {
      if (baked[name]) put(g, name, 0, cx - dims(name).width / 2, cy - dims(name).height / 2);
    }
    g.fillStyle = c.bg;
    g.fillRect(0, FLOOR_Y, ROOM_W, ROOM_H - FLOOR_Y);
    g.globalAlpha = 0.5;
    g.fillStyle = c.muted;
    g.fillRect(0, FLOOR_Y, ROOM_W, 1);
  }

  let scale = 1;
  let dpr = 1;
  let viewW = ROOM_W;
  let camX = 0;
  let sig = "";

  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth * dpr;
    scale = pickScale(wrap.clientWidth, wrap.clientHeight, dpr, reserveTop()).scale;
    viewW = Math.min(ROOM_W, Math.max(1, Math.floor(w / scale)));
    canvas.width = viewW * scale;
    canvas.height = ROOM_H * scale;
    canvas.style.width = `${(viewW * scale) / dpr}px`;
    canvas.style.height = `${(ROOM_H * scale) / dpr}px`;
    sig = "";
  };

  const draw = (s: State, o: DrawOptions) => {
    const tick = o.animate ? Math.floor(s.t * 2) : 0;
    const [hero, hf] =
      s.y > 0
        ? ["hero_jump", 0]
        : s.walking && o.animate
          ? ["hero_walk", Math.floor(s.t * 8) % 4]
          : ["hero_idle", tick % 2];
    camX = cameraX(s.x, viewW);
    const hx = Math.round(s.x - HERO_W / 2);
    const hy = Math.round(FLOOR_Y - HERO_H - s.y);
    const next = `${tick}|${hero}|${hf}|${hx}|${hy}|${s.facing}|${s.near}|${camX}|${o.bubble}`;
    if (next === sig) return;
    sig = next;

    ctx.setTransform(scale, 0, 0, scale, -camX * scale, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0);

    let tops = 0;
    for (const st of STATIONS) {
      const spr = dims(st.sprite);
      const cx = stationCenter(st);
      const y = FLOOR_Y - (st.lift ?? 0) - spr.height;
      put(ctx, st.sprite, tick, cx - spr.width / 2, y);
      if (st.id === s.near) {
        // Bobbing arrow above the nearest station, drawn after it so it shows.
        const a = dims("glow");
        tops = y;
        put(ctx, "glow", tick, cx - a.width / 2, y - a.height - 2);
      }
    }

    put(ctx, hero, hf as number, hx, hy, s.facing < 0);

    const near = s.near && stationById(s.near);
    if (o.bubble && near) {
      // Box in room px; text in a second pass at full backing resolution.
      // Shrink (down to 12 css px) so the bubble never covers most of a small view.
      ctx.font = `700 ${TEXT_PX * dpr}px ${FONT_FAMILY}`;
      const fit = (0.9 * viewW * scale - 2 * PAD_PX * dpr) / ctx.measureText(o.bubble).width;
      const px = Math.max(MIN_TEXT_PX, Math.min(TEXT_PX, TEXT_PX * fit));
      const font = `700 ${px * dpr}px ${FONT_FAMILY}`;
      ctx.font = font;
      const textW = ctx.measureText(o.bubble).width;
      const w = Math.ceil((textW + 2 * PAD_PX * dpr) / scale);
      const h = Math.ceil(((px + 8) * dpr) / scale);
      const bx = Math.round(Math.min(camX + viewW - w - 2, Math.max(camX + 2, stationCenter(near) - w / 2)));
      const by = Math.max(2, tops - dims("glow").height - 4 - h);
      ctx.fillStyle = c.panel;
      ctx.fillRect(bx, by, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = font;
      ctx.textBaseline = "middle";
      ctx.fillStyle = c.bg;
      ctx.fillText(o.bubble, (bx - camX) * scale + PAD_PX * dpr, (by + h / 2) * scale);
    }
  };

  resize();
  return { resize, draw, view: () => ({ camX, viewW }) };
}
