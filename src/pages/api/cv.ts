import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { get } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import { loadBlobPdf } from '../../lib/blob-load';
import { BLOB_PATHNAME, fail, handleCv, type PdfSource } from '../../lib/cv-route';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

const LOCAL_PATH = './private/Jayvee-Celestial-CV.pdf';

async function loadPdf(source: PdfSource, request: Request): Promise<BodyInit | null> {
  if (source === 'local') return new Uint8Array(await readFile(LOCAL_PATH));
  return loadBlobPdf(get, BLOB_PATHNAME, request, {
    BLOB_STORE_ID: process.env.BLOB_STORE_ID,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  });
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
