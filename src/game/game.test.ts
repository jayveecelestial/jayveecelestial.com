import assert from "node:assert/strict";
import { test } from "node:test";
import { bubbleText } from "./render.ts";
import { QUEST, announcement, isComplete, markDone, parseStored, shouldShowBanner } from "./quest.ts";
import { SPRITES } from "./sprites.ts";
import { NO_INPUT, initialState, resolveMode, update, type Input, type State } from "./state.ts";
import { MAX_X, MIN_X, ROOM_W, STATIONS, cameraX, clampX, hitStation, nearestStation, pickScale, stationCenter } from "./world.ts";

const DT = 1 / 60;
const step = (s: State, i: Partial<Input>, n = 1): State => {
  for (let k = 0; k < n; k++) s = update(s, { ...NO_INPUT, ...i }, DT);
  return s;
};

test("clampX holds hero inside the room", () => {
  assert.equal(clampX(-50), MIN_X);
  assert.equal(clampX(9999), MAX_X);
  assert.equal(clampX(100), 100);
});

test("walking left at the wall stays clamped", () => {
  const s = step({ ...initialState(), x: MIN_X }, { left: true }, 30);
  assert.equal(s.x, MIN_X);
});

test("nearestStation boundaries", () => {
  const about = STATIONS[0];
  assert.equal(nearestStation(about.x - 10)?.id, "about");
  assert.equal(nearestStation(about.x - 10.5), null);
  assert.equal(nearestStation(MIN_X), null);
  // work reach ends at 118, certs reach starts at 120
  assert.equal(nearestStation(118)?.id, "work");
  assert.equal(nearestStation(119), null);
  assert.equal(nearestStation(120)?.id, "certs");
  for (const s of STATIONS) assert.equal(nearestStation(stationCenter(s))?.id, s.id);
});

test("auto-walk stops at target and fires open once", () => {
  const goal = stationCenter(STATIONS.find((s) => s.id === "tools")!);
  let s = step(initialState(), { target: "tools" });
  const opens: string[] = [];
  for (let k = 0; k < 600; k++) {
    s = step(s, {});
    if (s.open) opens.push(s.open);
  }
  assert.deepEqual(opens, ["tools"]);
  assert.equal(s.x, goal);
  assert.equal(s.target, null);
});

test("manual walking cancels auto-walk", () => {
  let s = step(initialState(), { target: "contact" }, 5);
  assert.equal(s.target, "contact");
  s = step(s, { left: true });
  assert.equal(s.target, null);
});

test("act opens only when near a station", () => {
  const far = { ...initialState(), x: MIN_X }; // left of the first station
  assert.equal(nearestStation(far.x), null);
  assert.equal(step(far, { act: true }).open, null);
  const near = { ...initialState(), x: stationCenter(STATIONS[1]) };
  assert.equal(step(near, { act: true }).open, "work");
});

test("unknown target is ignored", () => {
  const s = step(initialState(), { target: "nope" }, 10);
  assert.equal(s.target, null);
  assert.equal(s.open, null);
});

test("jump rises then returns to floor", () => {
  let s = step(initialState(), { jump: true });
  assert.ok(s.y > 0);
  let peak = s.y;
  for (let k = 0; k < 120 && s.y > 0; k++) {
    s = step(s, {});
    peak = Math.max(peak, s.y);
  }
  assert.equal(s.y, 0);
  assert.equal(s.vy, 0);
  assert.ok(peak > 10);
});

test("no double jump in air", () => {
  let s = step(initialState(), { jump: true }, 1);
  const vy = s.vy;
  s = step(s, { jump: true });
  assert.ok(s.vy < vy);
});

test("auto-walk across the room finishes within 2.5s", () => {
  let s = step(initialState(), { target: "contact" });
  let n = 0;
  while (!s.open && n++ < 600) s = step(s, {});
  assert.equal(s.open, "contact");
  assert.ok(n * DT < 2.5);
});

test("walkTo empty floor walks there and opens nothing", () => {
  let s = step({ ...initialState(), x: 40 }, { walkTo: 125 });
  for (let k = 0; k < 300; k++) {
    s = step(s, {});
    assert.equal(s.open, null);
  }
  assert.equal(s.x, 125);
  assert.equal(s.goal, null);
});

test("hitStation opens only on the sprite box", () => {
  const work = STATIONS[1];
  assert.equal(hitStation(stationCenter(work), 150)?.id, "work");
  assert.equal(hitStation(stationCenter(work), 30), null); // wall above
  assert.equal(hitStation(stationCenter(work), 200), null); // floor in front
  assert.equal(hitStation(stationCenter(work), 110), null); // above the rack top (128)
  assert.equal(hitStation(125, 150), null); // gap between stations
  assert.equal(hitStation(62, 170), null);
  assert.equal(hitStation(130 + 24, 150)?.id, "certs");
  const about = STATIONS[0];
  assert.equal(hitStation(stationCenter(about), 110)?.id, "about"); // frame hangs on the wall
  assert.equal(hitStation(stationCenter(about), 170), null); // floor under the frame
});

test("cameraX follows hero and clamps to the room", () => {
  assert.equal(cameraX(0, 200), 0);
  assert.equal(cameraX(ROOM_W, 200), ROOM_W - 200);
  assert.equal(cameraX(192, 200), 92);
  assert.equal(cameraX(100, ROOM_W), 0);
});

test("resolveMode: only plain/play override stored", () => {
  assert.equal(resolveMode("plain", null), "plain");
  assert.equal(resolveMode("play", "plain"), "play");
  assert.equal(resolveMode("bogus", "plain"), "plain");
  assert.equal(resolveMode(null, "plain"), "plain");
  assert.equal(resolveMode(null, "junk"), "play");
  assert.equal(resolveMode(null, null), "play");
});

test("bubbleText per input mode", () => {
  assert.equal(bubbleText("work", "key"), "Press E: Quest log");
  assert.equal(bubbleText("work", "tap"), "Tap Open: Quest log");
  assert.equal(bubbleText("work", "poke"), "Tap: Quest log");
  assert.equal(bubbleText("certs", "click"), "Click: Trophies · 8 certs");
});

test("pickScale follows wrap height, camera when width is short", () => {
  assert.deepEqual(pickScale(390, 432, 3), { scale: 6, camera: true });
  assert.deepEqual(pickScale(360, 432, 3), { scale: 6, camera: true });
  assert.deepEqual(pickScale(1440, 803, 1), { scale: 3, camera: false });
  assert.deepEqual(pickScale(1440, 803, 2), { scale: 7, camera: false });
  assert.deepEqual(pickScale(100, 50, 1), { scale: 1, camera: true });
});

test("station boxes match their sprites", () => {
  for (const s of STATIONS) {
    assert.equal(s.w, SPRITES[s.sprite].w, s.id);
    assert.equal(s.h, SPRITES[s.sprite].h, s.id);
  }
  assert.equal(STATIONS[2].label, "Trophies · 8 certs");
});

test("quest markDone is idempotent and ignores unknown ids", () => {
  const a = markDone([], "work");
  assert.deepEqual(a, ["work"]);
  assert.equal(markDone(a, "work"), a);
  assert.equal(markDone(a, "about"), a);
  assert.equal(markDone(a, ""), a);
});

test("quest completes at 3 of 3 in any order", () => {
  let d = markDone([], "contact");
  d = markDone(d, "work");
  assert.equal(isComplete(d), false);
  d = markDone(d, "certs");
  assert.equal(isComplete(d), true);
  assert.equal(d.length, QUEST.length);
});

test("quest storage parse rejects junk", () => {
  assert.deepEqual(parseStored(null), []);
  assert.deepEqual(parseStored("not json"), []);
  assert.deepEqual(parseStored('{"work":true}'), []);
  assert.deepEqual(parseStored('"work"'), []);
  assert.deepEqual(parseStored('["work","hack",1,null,"work"]'), ["work"]);
  assert.deepEqual(parseStored('["contact","work","certs"]'), ["work", "certs", "contact"]);
});

test("quest announcements", () => {
  assert.equal(announcement(["work", "certs"], "certs"), "Quest 2 of 3: Trophies checked");
  assert.equal(announcement(["work", "certs", "contact"], "contact"), "Quest complete");
});

test("quest counts stay right after loading an out-of-order store", () => {
  let d = parseStored('["contact","work"]');
  assert.deepEqual(d, ["work", "contact"]);
  assert.equal(announcement(markDone(d, "certs"), "certs"), "Quest complete");
  d = markDone(d, "certs");
  assert.equal(d.length, 3);
  assert.equal(announcement(markDone(parseStored('["contact"]'), "work"), "work"), "Quest 2 of 3: Work read");
});

test("quest can be reset and completed again", () => {
  let d = markDone(markDone(markDone([], "work"), "certs"), "contact");
  assert.equal(isComplete(d), true);
  d = [];
  assert.equal(isComplete(d), false);
  for (const id of QUEST) d = markDone(d, id);
  assert.equal(isComplete(d), true);
});

test("shouldShowBanner only when complete and unseen", () => {
  const full = [...QUEST];
  assert.equal(shouldShowBanner(full, false), true);
  assert.equal(shouldShowBanner(full, true), false);
  assert.equal(shouldShowBanner(["work"], false), false);
  assert.equal(shouldShowBanner([], false), false);
});
