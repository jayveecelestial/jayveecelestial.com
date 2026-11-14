/** "SHIP IT" neon: lights after NEED pokes within WINDOW seconds. Room px. */
export const SIGN = { x: 292, y: 38, w: 40, h: 12 } as const;
export const WINDOW = 2;
export const NEED = 3;
/** Hero centre may be this far outside the sign span and still count as under it. */
const SLACK = 4;

export const underSign = (heroX: number): boolean => heroX >= SIGN.x - SLACK && heroX <= SIGN.x + SIGN.w + SLACK;

export const hitSign = (x: number, y: number): boolean =>
  x >= SIGN.x && x < SIGN.x + SIGN.w && y >= SIGN.y && y < SIGN.y + SIGN.h;

/** Record a poke at time t (s); keeps only hits inside the window. */
export function pokeSign(hits: readonly number[], t: number): { hits: number[]; lit: boolean } {
  const kept = [...hits.filter((h) => t - h <= WINDOW), t];
  return { hits: kept, lit: kept.length >= NEED };
}
