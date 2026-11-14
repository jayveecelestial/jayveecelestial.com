import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { get } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import { BLOB_PATHNAME, fail, handleCv, type PdfSource } from '../../lib/cv-route';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

const LOCAL_PATH = './private/Jayvee-Celestial-CV.pdf';

async function loadPdf(source: PdfSource): Promise<BodyInit | null> {
  if (source === 'local') return new Uint8Array(await readFile(LOCAL_PATH));
  const blob = await get(BLOB_PATHNAME, { access: 'private' });
  return blob?.statusCode === 200 ? blob.stream : null;
}

export const POST: APIRoute = ({ request, clientAddress }) =>
  handleCv(request, {
    vercelEnv: process.env.VERCEL_ENV,
    dev: import.meta.env.DEV,
    secret: getSecret('TURNSTILE_SECRET_KEY'),
    clientAddress,
    verify: verifyTurnstile,
    loadPdf,
  });

export const ALL: APIRoute = () => fail(405, 'Method Not Allowed', { Allow: 'POST' });
