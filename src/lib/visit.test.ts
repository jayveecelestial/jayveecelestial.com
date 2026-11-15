import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  counterEnabled,
  formatVisit,
  handleVisit,
  ipKey,
  ipPrefix,
  isBot,
  isValidId,
  parseVisit,
  readCreds,
  type VisitDeps,
} from './visit.ts';

const ID = '0b9c2f5e-6d1a-4c3b-8e7f-1a2b3c4d5e6f';
const NOW = Date.parse('2026-11-14T10:00:00Z');

function req(body: string | null, init: { method?: string; origin?: string; ua?: string } = {}): Request {
  const headers: Record<string, string> = { 'user-agent': init.ua ?? 'Mozilla/5.0 Safari' };
  if (init.origin) headers.origin = init.origin;
  return new Request('https://x.test/api/visit', { method: init.method ?? 'POST', headers, body });
}

function setup(over: Partial<VisitDeps> = {}) {
  const calls: unknown[] = [];
  const deps: VisitDeps = {
    vercelEnv: 'production',
    dev: false,
    url: 'https://redis.test',
    token: 't',
    clientAddress: () => '1.2.3.4',
    now: NOW,
    hit: async (a) => {
      calls.push(a);
      return { n: 42, visits: 3, total: 1234, totalVisits: 5678 };
    },
    ...over,
  };
  return { deps, calls };
}

const good = JSON.stringify({ id: ID });
const ORIGIN = 'https://jayveecelestial.com';

test('handleVisit: non-POST is 405', async () => {
  const { deps, calls } = setup();
  const res = await handleVisit(req(null, { method: 'GET' }), deps);
  assert.equal(res.status, 405);
  assert.equal(calls.length, 0);
});

test('handleVisit: disabled (no creds) is 204', async () => {
  for (const over of [{ url: undefined }, { token: undefined }, { vercelEnv: 'preview' }]) {
    const { deps, calls } = setup(over);
    const res = await handleVisit(req(good, { origin: ORIGIN }), deps);
    assert.equal(res.status, 204);
    assert.equal(calls.length, 0);
  }
});

test('handleVisit: production rejects missing or foreign origin with 403', async () => {
  for (const origin of [undefined, 'https://evil.test', 'https://jayveecelestial.com.evil.test']) {
    const { deps, calls } = setup();
    const res = await handleVisit(req(good, { origin }), deps);
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  }
});

test('handleVisit: www origin allowed', async () => {
  const { deps } = setup();
  const res = await handleVisit(req(good, { origin: 'https://www.jayveecelestial.com' }), deps);
  assert.equal(res.status, 200);
});

test('handleVisit: dev skips origin check', async () => {
  const { deps } = setup({ vercelEnv: undefined, dev: true });
  const res = await handleVisit(req(good), deps);
  assert.equal(res.status, 200);
});

test('handleVisit: bots get 204 and are not counted', async () => {
  for (const ua of ['Googlebot/2.1', 'HeadlessChrome/120', 'Chrome-Lighthouse', 'Slackbot-LinkExpanding']) {
    const { deps, calls } = setup();
    const res = await handleVisit(req(good, { origin: ORIGIN, ua }), deps);
    assert.equal(res.status, 204);
    assert.equal(calls.length, 0);
  }
});

test('handleVisit: bad bodies are 400', async () => {
  const bodies = [
    '',
    'not json',
    'null',
    '{}',
    JSON.stringify({ id: 'abc' }),
    JSON.stringify({ id: ID.toUpperCase() }),
    JSON.stringify({ id: ID.replace('-4c3b', '-1c3b') }),
    JSON.stringify({ id: 5 }),
    JSON.stringify({ id: ID, pad: 'x'.repeat(300) }),
  ];
  for (const body of bodies) {
    const { deps, calls } = setup();
    const res = await handleVisit(req(body, { origin: ORIGIN }), deps);
    assert.equal(res.status, 400, body.slice(0, 40));
    assert.equal(calls.length, 0);
  }
});

test('handleVisit: body limit is 256 bytes, counted in bytes not chars', async () => {
  const base = JSON.stringify({ id: ID, p: '' }).length;
  const fits = JSON.stringify({ id: ID, p: 'x'.repeat(256 - base) });
  assert.equal(new TextEncoder().encode(fits).length, 256);
  const over = JSON.stringify({ id: ID, p: 'x'.repeat(257 - base) });
  const multibyte = JSON.stringify({ id: ID, p: 'é'.repeat(130) });
  assert.ok(multibyte.length < 256);
  const ok = setup();
  assert.equal((await handleVisit(req(fits, { origin: ORIGIN }), ok.deps)).status, 200);
  for (const body of [over, multibyte]) {
    const { deps, calls } = setup();
    assert.equal((await handleVisit(req(body, { origin: ORIGIN }), deps)).status, 400);
    assert.equal(calls.length, 0);
  }
});

test('handleVisit: capped new visitor is 429', async () => {
  const { deps } = setup({ hit: async () => null });
  const res = await handleVisit(req(good, { origin: ORIGIN }), deps);
  assert.equal(res.status, 429);
});

test('handleVisit: redis failure is 503', async () => {
  const { deps } = setup({
    hit: async () => {
      throw new Error('boom');
    },
  });
  const res = await handleVisit(req(good, { origin: ORIGIN }), deps);
  assert.equal(res.status, 503);
});

test('handleVisit: success returns JSON, no-store, and hashed ip key', async () => {
  const { deps, calls } = setup();
  const res = await handleVisit(req(good, { origin: ORIGIN }), deps);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { n: 42, visits: 3, total: 1234, totalVisits: 5678 });
  assert.equal(calls.length, 1);
  const a = calls[0] as { id: string; ipKey: string; now: number };
  assert.equal(a.id, ID);
  assert.equal(a.now, NOW);
  assert.equal(a.ipKey, await ipKey('1.2.3.4', '2026-11-14', 't'));
  assert.ok(!a.ipKey.includes('1.2.3.4'));
});

test('counterEnabled matrix', () => {
  const c = { url: 'u', token: 't' };
  assert.equal(counterEnabled({ vercelEnv: 'production', dev: false, ...c }), true);
  assert.equal(counterEnabled({ vercelEnv: undefined, dev: true, ...c }), true);
  assert.equal(counterEnabled({ vercelEnv: 'preview', dev: false, ...c }), false);
  assert.equal(counterEnabled({ vercelEnv: undefined, dev: false, ...c }), false);
  assert.equal(counterEnabled({ vercelEnv: 'production', dev: true, url: undefined, token: 't' }), false);
  assert.equal(counterEnabled({ vercelEnv: 'production', dev: true, url: 'u', token: undefined }), false);
  assert.equal(counterEnabled({ vercelEnv: 'production', dev: true, url: '', token: '' }), false);
});

test('readCreds: KV only, UPSTASH only, both prefers UPSTASH', () => {
  const from = (m: Record<string, string>) => (k: string) => m[k];
  assert.deepEqual(readCreds(from({ KV_REST_API_URL: 'ku', KV_REST_API_TOKEN: 'kt' })), { url: 'ku', token: 'kt' });
  assert.deepEqual(readCreds(from({ UPSTASH_REDIS_REST_URL: 'uu', UPSTASH_REDIS_REST_TOKEN: 'ut' })), {
    url: 'uu',
    token: 'ut',
  });
  assert.deepEqual(
    readCreds(
      from({
        UPSTASH_REDIS_REST_URL: 'uu',
        UPSTASH_REDIS_REST_TOKEN: 'ut',
        KV_REST_API_URL: 'ku',
        KV_REST_API_TOKEN: 'kt',
      }),
    ),
    { url: 'uu', token: 'ut' },
  );
  assert.deepEqual(readCreds(from({})), { url: undefined, token: undefined });
});

test('parseVisit accepts good shape and rejects bad ones', () => {
  assert.deepEqual(parseVisit({ n: 1, visits: 1, total: 1, totalVisits: 1 }), { n: 1, visits: 1, total: 1, totalVisits: 1 });
  assert.deepEqual(parseVisit({ n: 5, visits: 2, total: 9, totalVisits: 20, extra: 1 }), {
    n: 5,
    visits: 2,
    total: 9,
    totalVisits: 20,
  });
  // Before the backfill a returning visitor's own visits can exceed the site total.
  assert.deepEqual(parseVisit({ n: 1, visits: 7, total: 1, totalVisits: 1 }), { n: 1, visits: 7, total: 1, totalVisits: 1 });
  for (const bad of [
    null,
    undefined,
    'x',
    [],
    {},
    { n: 0, visits: 1, total: 1, totalVisits: 1 },
    { n: 1, visits: 0, total: 1, totalVisits: 1 },
    { n: 2, visits: 1, total: 1, totalVisits: 1 },
    { n: 1.5, visits: 1, total: 2, totalVisits: 1 },
    { n: '1', visits: 1, total: 1, totalVisits: 1 },
    { n: -1, visits: 1, total: 1, totalVisits: 1 },
    { n: 1, visits: 1, total: 1 },
    { n: 1, visits: 1, total: 1, totalVisits: 0 },
    { n: 1, visits: 1, total: 1, totalVisits: 1.5 },
    { n: 1, visits: 1, total: 1, totalVisits: '1' },
    { n: NaN, visits: 1, total: 1, totalVisits: 1 },
  ]) {
    assert.equal(parseVisit(bad), null, JSON.stringify(bad));
  }
});

test('formatVisit groups thousands, no padding', () => {
  assert.deepEqual(formatVisit({ n: 42, visits: 3, total: 1234, totalVisits: 5678 }), {
    n: '42',
    visits: '3',
    total: '1,234',
    totalVisits: '5,678',
  });
  assert.deepEqual(formatVisit({ n: 1000000, visits: 12, total: 1234567, totalVisits: 9876543 }), {
    n: '1,000,000',
    visits: '12',
    total: '1,234,567',
    totalVisits: '9,876,543',
  });
});

test('isValidId / isBot', () => {
  assert.equal(isValidId(ID), true);
  assert.equal(isValidId(ID + 'a'), false);
  assert.equal(isValidId(undefined), false);
  assert.equal(isBot(null), false);
  assert.equal(isBot('Mozilla/5.0 Safari'), false);
  assert.equal(isBot('Googlebot'), true);
});

test('ipKey is stable per day and differs across days, ips and keys', async () => {
  const a = await ipKey('1.2.3.4', '2026-11-14', 'k');
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, await ipKey('1.2.3.4', '2026-11-14', 'k'));
  assert.notEqual(a, await ipKey('1.2.3.4', '2026-11-15', 'k'));
  assert.notEqual(a, await ipKey('1.2.3.5', '2026-11-14', 'k'));
  assert.notEqual(a, await ipKey('1.2.3.4', '2026-11-14', 'k2'));
});

test('ipPrefix: IPv4 as is, mapped IPv4 unwrapped, IPv6 keyed on /64', () => {
  assert.equal(ipPrefix('1.2.3.4'), '1.2.3.4');
  assert.equal(ipPrefix('::ffff:1.2.3.4'), '1.2.3.4');
  assert.equal(ipPrefix('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2');
  assert.equal(ipPrefix('2001:db8:1:2::1'), '2001:db8:1:2');
  assert.equal(ipPrefix('2001:DB8:0001:0002:0:0:0:9'), '2001:db8:1:2');
  assert.equal(ipPrefix('2001:db8::1'), '2001:db8:0:0');
  assert.equal(ipPrefix('::1'), '0:0:0:0');
  assert.equal(ipPrefix('fe80::1%eth0'), 'fe80:0:0:0');
  assert.equal(ipPrefix('2001:db8:1:2:3::'), '2001:db8:1:2');
  assert.equal(ipPrefix('2001:db8:1:2::1'), ipPrefix('2001:db8:1:2:ffff::7'));
  assert.notEqual(ipPrefix('2001:db8:1:2::1'), ipPrefix('2001:db8:1:3::1'));
});

test('handleVisit: unavailable client address is 503 after gates, never reaches hit', async () => {
  const boom = () => {
    throw new Error('no address');
  };
  const { deps, calls } = setup({ clientAddress: boom });
  assert.equal((await handleVisit(req(good, { origin: ORIGIN }), deps)).status, 503);
  assert.equal(calls.length, 0);
  // gates run first: the getter is never read for a foreign origin
  let read = false;
  const spy = setup({ clientAddress: () => ((read = true), '1.2.3.4') });
  assert.equal((await handleVisit(req(good, { origin: 'https://evil.test' }), spy.deps)).status, 403);
  assert.equal(read, false);
});

test('handleVisit: IPv6 clients are keyed on /64', async () => {
  const a = setup({ clientAddress: () => '2001:db8:1:2::1' });
  const b = setup({ clientAddress: () => '2001:db8:1:2:f::9' });
  await handleVisit(req(good, { origin: ORIGIN }), a.deps);
  await handleVisit(req(good, { origin: ORIGIN }), b.deps);
  assert.equal((a.calls[0] as { ipKey: string }).ipKey, (b.calls[0] as { ipKey: string }).ipKey);
});

test('handleVisit: oversized content-length is 400 before reading the body', async () => {
  const { deps, calls } = setup();
  const r = new Request('https://x.test/api/visit', {
    method: 'POST',
    headers: { 'user-agent': 'Mozilla/5.0', origin: ORIGIN, 'content-length': '257' },
    body: good,
  });
  let read = false;
  r.text = async () => ((read = true), good);
  assert.equal((await handleVisit(r, deps)).status, 400);
  assert.equal(read, false);
  assert.equal(calls.length, 0);
});
