import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blobAuth, loadBlobPdf, type BlobGet } from './blob-load.ts';

const req = (token?: string) =>
  new Request('https://x.test/api/cv', { method: 'POST', headers: token ? { 'x-vercel-oidc-token': token } : {} });

const SECRET = 'SECRET-OIDC-JWT';

test('oidc header + store id -> oidc options', () => {
  assert.deepEqual(blobAuth(req(SECRET), { BLOB_STORE_ID: 'store_1' }), {
    mode: 'oidc',
    options: { oidcToken: SECRET, storeId: 'store_1' },
  });
});

test('missing header -> no oidcToken; token fallback or none', () => {
  assert.deepEqual(blobAuth(req(), { BLOB_STORE_ID: 's', BLOB_READ_WRITE_TOKEN: 't' }), { mode: 'token', options: {} });
  assert.deepEqual(blobAuth(req(), {}), { mode: 'none', options: {} });
});

test('header without store id -> not passed', () => {
  assert.deepEqual(blobAuth(req(SECRET), {}), { mode: 'none', options: {} });
});

test('loader passes oidc options to get and returns stream', async () => {
  const stream = new ReadableStream<Uint8Array>();
  const seen: unknown[] = [];
  const get: BlobGet = async (p, o) => (seen.push([p, o]), { statusCode: 200, stream });
  const out = await loadBlobPdf(get, 'cv/a.pdf', req(SECRET), { BLOB_STORE_ID: 'store_1' }, () => {});
  assert.equal(out, stream);
  assert.deepEqual(seen, [['cv/a.pdf', { access: 'private', oidcToken: SECRET, storeId: 'store_1' }]]);
});

test('null / non-200 logs status and pathname, no secrets', async () => {
  for (const res of [null, { statusCode: 304 }]) {
    const logs: unknown[][] = [];
    const out = await loadBlobPdf(async () => res, 'cv/a.pdf', req(SECRET), { BLOB_STORE_ID: 's' }, (...a) => logs.push(a));
    assert.equal(out, null);
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], '[cv] blob get');
    assert.equal((logs[0][1] as { pathname: string }).pathname, 'cv/a.pdf');
    assert.ok(!JSON.stringify(logs).includes(SECRET));
  }
});

test('throw logs name+message, rethrows, no secrets', async () => {
  const logs: unknown[][] = [];
  const get: BlobGet = async () => {
    throw new TypeError('boom');
  };
  await assert.rejects(loadBlobPdf(get, 'p', req(SECRET), { BLOB_STORE_ID: 's' }, (...a) => logs.push(a)), /boom/);
  assert.deepEqual(logs[0].slice(0, 3), ['[cv] blob get failed', 'TypeError', 'boom']);
  assert.ok(!JSON.stringify(logs).includes(SECRET));
});
