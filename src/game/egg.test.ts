import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGN, hitSign, pokeSign, underSign } from "./egg.ts";
import { NO_INPUT, initialState, update } from "./state.ts";

const STEP = 1 / 60;

test("3 pokes within 2 s light the sign", () => {
  let r = pokeSign([], 0);
  r = pokeSign(r.hits, 0.5);
  assert.equal(r.lit, false);
  r = pokeSign(r.hits, 2);
  assert.equal(r.lit, true);
});

test("2 pokes do not light", () => {
  assert.equal(pokeSign(pokeSign([], 0).hits, 1).lit, false);
});

test("spread-out third poke does not light; old hits drop", () => {
  const r = pokeSign(pokeSign(pokeSign([], 0).hits, 1).hits, 2.5);
  assert.equal(r.lit, false);
  assert.deepEqual(r.hits, [1, 2.5]);
});

test("hitSign edges", () => {
  assert.equal(hitSign(SIGN.x, SIGN.y), true);
  assert.equal(hitSign(SIGN.x + SIGN.w - 1, SIGN.y + SIGN.h - 1), true);
  assert.equal(hitSign(SIGN.x - 1, SIGN.y), false);
  assert.equal(hitSign(SIGN.x + SIGN.w, SIGN.y), false);
  assert.equal(hitSign(SIGN.x, SIGN.y - 1), false);
  assert.equal(hitSign(SIGN.x, SIGN.y + SIGN.h), false);
});

test("underSign edges", () => {
  assert.equal(underSign(SIGN.x - 4), true);
  assert.equal(underSign(SIGN.x + SIGN.w + 4), true);
  assert.equal(underSign(SIGN.x - 5), false);
  assert.equal(underSign(SIGN.x + SIGN.w + 5), false);
});

/** Land, then start a jump; returns state after the jump frame. */
const hop = (s: ReturnType<typeof initialState>) => {
  let n = update(s, { ...NO_INPUT, jump: true }, STEP);
  while (n.y > 0) n = update(n, NO_INPUT, STEP);
  return n;
};

test("jumps under the sign light it; sticky afterwards", () => {
  let s = { ...initialState(), x: SIGN.x + SIGN.w / 2 };
  s = hop(hop(s));
  assert.equal(s.lit, false);
  s = hop(s);
  assert.equal(s.lit, true);
  s = update(s, NO_INPUT, 10);
  assert.equal(s.lit, true);
});

test("jumps elsewhere and walking under the sign do not count", () => {
  let s = hop(hop(hop(initialState())));
  assert.equal(s.lit, false);
  s = { ...initialState(), x: SIGN.x + 10 };
  for (let i = 0; i < 5; i++) s = update(s, { ...NO_INPUT, right: i % 2 === 0, left: i % 2 === 1 }, STEP);
  assert.equal(s.signHits.length, 0);
  assert.equal(s.lit, false);
});

test("taps on the sign count via poke", () => {
  let s = initialState();
  for (let i = 0; i < 3; i++) s = update(s, { ...NO_INPUT, poke: true }, 0.3);
  assert.equal(s.lit, true);
});

test("a jump pressed mid-air does not count as a poke", () => {
  let s = { ...initialState(), x: SIGN.x + SIGN.w / 2 };
  s = update(s, { ...NO_INPUT, jump: true }, STEP);
  assert.ok(s.y > 0);
  const before = s.signHits.length;
  for (let i = 0; i < 3 && s.y > 0; i++) s = update(s, { ...NO_INPUT, jump: true }, STEP);
  assert.ok(s.y > 0);
  assert.equal(s.signHits.length, before);
  assert.equal(s.lit, false);
});
