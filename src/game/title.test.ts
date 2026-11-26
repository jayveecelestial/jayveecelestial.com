import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowTitle } from "./title.ts";

const first = { view: null, hash: "", tutorialSeen: false };

test("title shows on a plain first visit", () => {
  assert.equal(shouldShowTitle(first), true);
  assert.equal(shouldShowTitle({ ...first, hash: "#" }), true);
});

test("title is skipped for returning visitors", () => {
  assert.equal(shouldShowTitle({ ...first, tutorialSeen: true }), false);
});

test("title is skipped when a view is asked for", () => {
  assert.equal(shouldShowTitle({ ...first, view: "play" }), false);
  assert.equal(shouldShowTitle({ ...first, view: "plain" }), false);
});

test("unknown view values do not skip it", () => {
  assert.equal(shouldShowTitle({ ...first, view: "junk" }), true);
});

test("title is skipped for deep links", () => {
  assert.equal(shouldShowTitle({ ...first, hash: "#work" }), false);
  assert.equal(shouldShowTitle({ ...first, hash: "#contact" }), false);
});
