import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, readToken, verifyTurnstile } from './turnstile.ts';

const expect = { hostnames: ['jayveecelestial.com', 'www.jayveecelestial.com'], action: 'cv' };

function stub(response: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response();
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
const input = { token: 'tok', secret: 'sec', remoteip: '1.2.3.4' };

test('readToken accepts 1..2048 chars only', () => {
  assert.equal(readToken('a'), 'a');
  assert.equal(readToken('a'.repeat(2048)), 'a'.repeat(2048));
  assert.equal(readToken(''), null);
  assert.equal(readToken('a'.repeat(2049)), null);
  assert.equal(readToken(null), null);
  assert.equal(readToken(new File([], 'x')), null);
});

test('verify succeeds on success:true', async () => {
  const { fetchImpl } = stub(() => json({ success: true }));
  assert.deepEqual(await verifyTurnstile({ ...input, fetchImpl }), { ok: true });
});

test('verify rejects success:false with reason', async () => {
  const { fetchImpl } = stub(() => json({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
  assert.deepEqual(await verifyTurnstile({ ...input, fetchImpl }), { ok: false, kind: 'rejected', reason: 'timeout-or-duplicate' });
});

test('verify fails closed when fetch throws', async () => {
  const { fetchImpl } = stub(() => {
    throw new Error('down');
  });
  const v = await verifyTurnstile({ ...input, fetchImpl });
  assert.deepEqual(v, { ok: false, kind: 'unavailable', reason: 'siteverify-unreachable' });
});

test('verify fails closed on timeout', async () => {
  const fetchImpl = ((_u: string, init: RequestInit) =>
    new Promise((_res, rej) => {
      init.signal!.addEventListener('abort', () => rej(init.signal!.reason));
    })) as unknown as typeof fetch;
  const v = await verifyTurnstile({ ...input, fetchImpl, timeoutMs: 10 });
  assert.equal(v.ok, false);
});

test('verify fails closed on non-200 and bad JSON', async () => {
  const a = stub(() => json({ success: true }, 500));
  assert.equal((await verifyTurnstile({ ...input, fetchImpl: a.fetchImpl })).ok, false);
  assert.equal((await verifyTurnstile({ ...input, fetchImpl: a.fetchImpl }) as { kind: string }).kind, 'unavailable');
  const b = stub(() => new Response('not json', { status: 200 }));
  assert.equal((await verifyTurnstile({ ...input, fetchImpl: b.fetchImpl })).ok, false);
  const c = stub(() => json(null));
  assert.equal((await verifyTurnstile({ ...input, fetchImpl: c.fetchImpl })).ok, false);
});

test('hostname and action mismatch fail when expect set', () => {
  assert.deepEqual(judge({ success: true, hostname: 'evil.example', action: 'cv' }, expect), {
    ok: false,
    kind: 'rejected',
    reason: 'hostname-mismatch',
  });
  assert.deepEqual(judge({ success: true, hostname: 'jayveecelestial.com', action: 'x' }, expect), {
    ok: false,
    kind: 'rejected',
    reason: 'action-mismatch',
  });
  assert.deepEqual(judge({ success: true }, expect), { ok: false, kind: 'rejected', reason: 'hostname-mismatch' });
  assert.deepEqual(judge({ success: true, hostname: 'www.jayveecelestial.com', action: 'cv' }, expect), { ok: true });
});

test('expect unset ignores hostname and action', () => {
  assert.deepEqual(judge({ success: true, hostname: 'evil.example', action: 'x' }), { ok: true });
});

test('request posts secret, response, remoteip to siteverify', async () => {
  const { calls, fetchImpl } = stub(() => json({ success: true }));
  await verifyTurnstile({ ...input, fetchImpl });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(calls[0].init.method, 'POST');
  const body = calls[0].init.body as URLSearchParams;
  assert.equal(body.get('secret'), 'sec');
  assert.equal(body.get('response'), 'tok');
  assert.equal(body.get('remoteip'), '1.2.3.4');
});

test('cloudflare internal-error is unavailable, not rejected', () => {
  assert.deepEqual(judge({ success: false, 'error-codes': ['internal-error'] }), {
    ok: false,
    kind: 'unavailable',
    reason: 'internal-error',
  });
});
