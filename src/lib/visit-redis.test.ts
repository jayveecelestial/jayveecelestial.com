import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { hit, SCRIPT } from './visit-redis.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const args = { url: 'https://redis.test', token: 'tok', id: 'the-id', ipKey: 'abc123', now: 1_700_000_000_000 };

function stub(res: Response) {
  const seen: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return res;
  }) as typeof fetch;
  return seen;
}

const reply = (result: unknown) => new Response(JSON.stringify({ result }), { status: 200 });

test('hit: sends EVAL with keys, now, window and caps, Bearer auth', async () => {
  const seen = stub(reply([5, 2, 9]));
  assert.deepEqual(await hit(args), { n: 5, visits: 2, total: 9 });
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.url, args.url);
  const headers = seen[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(seen[0]?.init.body as string), [
    'EVAL',
    SCRIPT,
    4,
    'vc:total',
    'vc:v:the-id',
    'vc:ip:abc123',
    'vc:rl:abc123',
    1_700_000_000_000,
    1_800_000,
    10,
    120,
  ]);
});

test('hit: [0,0,0] means capped (null)', async () => {
  stub(reply([0, 0, 0]));
  assert.equal(await hit(args), null);
});

test('hit: non-ok status throws', async () => {
  stub(new Response('nope', { status: 500 }));
  await assert.rejects(hit(args), /redis 500/);
});

test('hit: bad reply shapes throw', async () => {
  for (const result of [undefined, 'x', [1, 2], [1, 2, 3, 4], [3, 1, 2], [1.5, 1, 2]]) {
    stub(reply(result));
    await assert.rejects(hit(args), /bad reply/, JSON.stringify(result));
  }
});
