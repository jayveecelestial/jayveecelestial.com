import { readToken, type Expect, type Verdict } from './turnstile.ts';

export const BLOB_PATHNAME = 'cv/Jayvee-Celestial-CV.pdf';

const PROD_EXPECT: Expect = {
  hostnames: ['jayveecelestial.com', 'www.jayveecelestial.com'],
  action: 'cv',
};

const PDF_HEADERS = {
  'Content-Type': 'application/pdf',
  'Content-Disposition': 'attachment; filename="Jayvee-Celestial-CV.pdf"',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
};

export type PdfSource = 'blob' | 'local';

export type CvDeps = {
  /** process.env.VERCEL_ENV */
  vercelEnv: string | undefined;
  /** import.meta.env.DEV */
  dev: boolean;
  secret: string | undefined;
  clientAddress: string | undefined;
  verify: (input: { token: string; secret: string; remoteip?: string; expect?: Expect }) => Promise<Verdict>;
  loadPdf: (source: PdfSource, request: Request) => Promise<BodyInit | null>;
};

export const fail = (status: number, message: string, extra: Record<string, string> = {}) =>
  new Response(message, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', ...extra },
  });

/** Blob only in production, local file only under `astro dev`; every other env fails closed. */
export function pdfSource({ vercelEnv, dev }: Pick<CvDeps, 'vercelEnv' | 'dev'>): PdfSource | null {
  if (vercelEnv === 'production') return 'blob';
  return dev ? 'local' : null;
}

export async function handleCv(request: Request, deps: CvDeps): Promise<Response> {
  if (request.method !== 'POST') return fail(405, 'Method Not Allowed', { Allow: 'POST' });

  let token: string | null = null;
  try {
    token = readToken((await request.formData()).get('cf-turnstile-response'));
  } catch {
    // not a form body
  }
  if (!token) return fail(400, 'Missing verification token');

  const source = pdfSource(deps);
  if (!source || !deps.secret) return fail(503, 'Verification unavailable');

  // Test keys return neither the real hostname nor the action, so only production checks them.
  const verdict = await deps.verify({
    token,
    secret: deps.secret,
    remoteip: deps.clientAddress,
    expect: source === 'blob' ? PROD_EXPECT : undefined,
  });
  if (!verdict.ok) {
    return verdict.kind === 'unavailable'
      ? fail(503, 'Verification unavailable')
      : fail(403, 'Verification failed');
  }

  let pdf: BodyInit | null;
  try {
    pdf = await deps.loadPdf(source, request);
  } catch {
    pdf = null;
  }
  if (!pdf) return fail(503, 'CV unavailable');
  return new Response(pdf, { status: 200, headers: PDF_HEADERS });
}
