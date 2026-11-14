import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCv, pdfSource, type CvDeps } from './cv-route.ts';

const post = (fields: Record<string, string> = { 'cf-turnstile-response': 'tok' }) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('https://x.test/api/cv', { method: 'POST', body });
};

function deps(over: Partial<CvDeps> = {}) {
  const calls = { verify: [] as Parameters<CvDeps['verify']>[0][], load: [] as string[], req: [] as Request[] };
  const d: CvDeps = {
    vercelEnv: 'production',
    dev: false,
    secret: 'sec',
    clientAddress: '1.2.3.4',
    verify: async (i) => (calls.verify.push(i), { ok: true }),
    loadPdf: async (s, r) => (calls.load.push(s), calls.req.push(r), 'PDFBYTES'),
    ...over,
  };
  return { d, calls };
}

test('400 on missing, empty and oversize token; verify never called', async () => {
  for (const fields of [{}, { 'cf-turnstile-response': '' }, { 'cf-turnstile-response': 'a'.repeat(2049) }]) {
    const { d, calls } = deps();
    assert.equal((await handleCv(post(fields), d)).status, 400);
    assert.equal(calls.verify.length, 0);
  }
  const { d } = deps();
  const json = new Request('https://x.test/api/cv', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  assert.equal((await handleCv(json, d)).status, 400);
});

test('403 when token rejected; PDF never loaded', async () => {
  const { d, calls } = deps({ verify: async () => ({ ok: false, kind: 'rejected', reason: 'invalid-input-response' }) });
  assert.equal((await handleCv(post(), d)).status, 403);
  assert.equal(calls.load.length, 0);
});

test('503 when verification unavailable', async () => {
  const { d, calls } = deps({ verify: async () => ({ ok: false, kind: 'unavailable', reason: 'siteverify-status' }) });
  assert.equal((await handleCv(post(), d)).status, 503);
  assert.equal(calls.load.length, 0);
});

test('503 when secret missing; verify not called', async () => {
  const { d, calls } = deps({ secret: undefined });
  assert.equal((await handleCv(post(), d)).status, 503);
  assert.equal(calls.verify.length, 0);
});

test('503 on preview and unknown envs (fail closed), no verify, no load', async () => {
  for (const vercelEnv of ['preview', 'development', undefined, '', 'Production']) {
    const { d, calls } = deps({ vercelEnv });
    assert.equal((await handleCv(post(), d)).status, 503, String(vercelEnv));
    assert.equal(calls.verify.length + calls.load.length, 0);
  }
});

test('pdfSource: blob only in production, local only in dev', () => {
  assert.equal(pdfSource({ vercelEnv: 'production', dev: false }), 'blob');
  assert.equal(pdfSource({ vercelEnv: undefined, dev: true }), 'local');
  assert.equal(pdfSource({ vercelEnv: 'preview', dev: false }), null);
});

test('503 when PDF missing or loader throws', async () => {
  assert.equal((await handleCv(post(), deps({ loadPdf: async () => null }).d)).status, 503);
  assert.equal(
    (await handleCv(post(), deps({ loadPdf: async () => { throw new Error('blob down'); } }).d)).status,
    503,
  );
});

test('200 serves PDF with download headers from blob in production', async () => {
  const { d, calls } = deps();
  const res = await handleCv(post(), d);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'PDFBYTES');
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="Jayvee-Celestial-CV.pdf"');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('x-robots-tag')!, /noindex/);
  assert.deepEqual(calls.load, ['blob']);
});

test('production verify expects real hostnames and action cv', async () => {
  const { d, calls } = deps();
  await handleCv(post(), d);
  assert.equal(calls.verify[0].expect?.action, 'cv');
  assert.deepEqual(calls.verify[0].expect?.hostnames, ['jayveecelestial.com', 'www.jayveecelestial.com']);
  assert.equal(calls.verify[0].remoteip, '1.2.3.4');
});

test('dev uses local file and no hostname/action expectation', async () => {
  const { d, calls } = deps({ vercelEnv: undefined, dev: true });
  assert.equal((await handleCv(post(), d)).status, 200);
  assert.deepEqual(calls.load, ['local']);
  assert.equal(calls.verify[0].expect, undefined);
});

test('remoteip is undefined when client address unknown', async () => {
  const { d, calls } = deps({ clientAddress: undefined });
  await handleCv(post(), d);
  assert.equal(calls.verify[0].remoteip, undefined);
});

test('405 for non-POST with Allow header', async () => {
  const { d, calls } = deps();
  const res = await handleCv(new Request('https://x.test/api/cv', { method: 'GET' }), d);
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'POST');
  assert.equal(calls.verify.length, 0);
});

test('loader receives the incoming request (carries x-vercel-oidc-token)', async () => {
  const { d, calls } = deps();
  const r = post();
  r.headers.set('x-vercel-oidc-token', 'abc');
  await handleCv(r, d);
  assert.equal(calls.req[0].headers.get('x-vercel-oidc-token'), 'abc');
});
