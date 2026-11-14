import assert from "node:assert/strict";
import { test } from "node:test";
import { QUEST } from "./quest.ts";
import { PEAK_GAIN, SFX, createSound, parsePref, sfxForQuest } from "./sound.ts";

test("parsePref is true only for 'on'", () => {
  assert.equal(parsePref(null), false);
  assert.equal(parsePref("x"), false);
  assert.equal(parsePref("off"), false);
  assert.equal(parsePref("on"), true);
});

test("sfxForQuest: task, task, complete", () => {
  assert.equal(sfxForQuest([], QUEST[0]), "task");
  assert.equal(sfxForQuest([QUEST[0]], QUEST[1]), "task");
  assert.equal(sfxForQuest([QUEST[0], QUEST[1]], QUEST[2]), "complete");
});

test("sfxForQuest: repeats and non-quest ids are silent", () => {
  assert.equal(sfxForQuest([QUEST[0]], QUEST[0]), null);
  assert.equal(sfxForQuest([...QUEST], QUEST[1]), null);
  assert.equal(sfxForQuest([], "about"), null);
});

test("SFX specs are short, in range and quiet", () => {
  assert.ok(PEAK_GAIN <= 0.1);
  for (const tones of Object.values(SFX)) {
    assert.ok(tones.reduce((s, t) => s + t.ms, 0) < 600);
    for (const t of tones)
      for (const f of [t.from, t.to ?? t.from]) assert.ok(f >= 100 && f <= 2000);
  }
});

// ---- lifecycle, with a fake AudioContext ----
type FakeNode = { connect(n: unknown): unknown; disconnect(): void; disconnected: boolean; onended?: () => void } & Record<string, unknown>;
const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });

function setup(resumeTo: string = "running") {
  const target = new EventTarget();
  const made: FakeCtx[] = [];
  const nodes: FakeNode[] = [];
  let isHidden = false;
  class FakeCtx {
    state = "suspended";
    currentTime = 0;
    destination = {};
    suspended = 0;
    onstatechange: (() => void) | null = null;
    resume = async () => {
      this.state = resumeTo;
    };
    suspend = async () => {
      this.suspended++;
      this.state = "suspended";
    };
    node = (): FakeNode => {
      const n: FakeNode = {
        disconnected: false,
        connect: (to) => to,
        disconnect: () => {
          n.disconnected = true;
        },
        frequency: param(),
        gain: param(),
        start() {},
        stop() {},
      };
      nodes.push(n);
      return n;
    };
    createOscillator = this.node;
    createGain = this.node;
  }
  const sound = createSound({
    make: () => {
      const c = new FakeCtx();
      made.push(c);
      return c as unknown as AudioContext;
    },
    hidden: () => isHidden,
    target,
    doc: target,
  });
  const fire = async (type: string) => {
    target.dispatchEvent(new Event(type));
    await new Promise((r) => setTimeout(r, 0));
  };
  return { sound, made, nodes, fire, hide: (v: boolean) => (isHidden = v) };
}

test("no AudioContext before a gesture", async () => {
  const { sound, made, fire } = setup();
  sound.enable();
  sound.play("jump");
  assert.equal(made.length, 0);
  await fire("pointerdown");
  await fire("touchstart");
  assert.equal(made.length, 0);
  await fire("touchend");
  assert.equal(made.length, 1);
});

test("play is a no-op until running, when disabled, and while hidden", async () => {
  const { sound, made, nodes, fire, hide } = setup();
  sound.play("jump");
  sound.enable();
  sound.play("jump");
  assert.equal(nodes.length, 0);
  await fire("click");
  hide(true);
  sound.play("jump");
  assert.equal(nodes.length, 0);
  hide(false);
  sound.play("jump");
  assert.equal(nodes.length, 2);
  sound.disable();
  sound.play("jump");
  assert.equal(nodes.length, 2);
  assert.equal(made.length, 1);
});

test("disable suspends; enable in a gesture resumes the same context", async () => {
  const { sound, made, fire } = setup();
  sound.enable();
  await fire("keydown");
  sound.disable();
  assert.equal(made[0].suspended, 1);
  sound.enable(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(made.length, 1);
  assert.equal(made[0].state, "running");
});

test("stays armed until running, and re-arms when the context leaves running", async () => {
  const { sound, made, fire } = setup("suspended");
  sound.enable();
  await fire("click");
  await fire("click");
  assert.equal(made.length, 1);
  assert.equal(made[0].state, "suspended");

  const ok = setup();
  ok.sound.enable();
  await ok.fire("click");
  assert.equal(ok.made[0].state, "running");
  const calls = ok.made.length;
  ok.made[0].state = "suspended"; // lock is not re-armed yet, so a click does nothing
  await ok.fire("click");
  assert.equal(ok.made[0].state, "suspended");
  ok.made[0].onstatechange?.();
  await ok.fire("click");
  assert.equal(ok.made[0].state, "running");
  assert.equal(ok.made.length, calls);
});

test("re-arms when the tab becomes visible again", async () => {
  const { sound, made, fire } = setup();
  sound.enable();
  await fire("click");
  made[0].state = "interrupted";
  await fire("visibilitychange");
  await fire("click");
  assert.equal(made[0].state, "running");
});

test("oscillator end disconnects osc and gain", async () => {
  const { sound, nodes, fire } = setup();
  sound.enable();
  await fire("click");
  sound.play("jump");
  assert.equal(nodes.length, 2);
  for (const n of nodes) n.onended?.();
  assert.ok(nodes.every((n) => n.disconnected));
});
