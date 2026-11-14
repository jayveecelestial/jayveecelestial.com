export type BlobAuthMode = 'oidc' | 'token' | 'none';

export type BlobEnv = { BLOB_STORE_ID?: string; BLOB_READ_WRITE_TOKEN?: string };

/** Minimal shape of `get` from @vercel/blob that we use. */
export type BlobGet = (
  pathname: string,
  options: { access: 'private'; oidcToken?: string; storeId?: string },
) => Promise<{ statusCode: number; stream?: ReadableStream<Uint8Array> } | null>;

/**
 * Astro's Vercel adapter does not register the request context the SDK reads the OIDC token from,
 * so pass the `x-vercel-oidc-token` header ourselves. Without it the SDK falls back to BLOB_READ_WRITE_TOKEN.
 */
export function blobAuth(
  request: Request,
  env: BlobEnv,
): { mode: BlobAuthMode; options: { oidcToken?: string; storeId?: string } } {
  const oidcToken = request.headers.get('x-vercel-oidc-token')?.trim();
  if (oidcToken && env.BLOB_STORE_ID) {
    return { mode: 'oidc', options: { oidcToken, storeId: env.BLOB_STORE_ID } };
  }
  return { mode: env.BLOB_READ_WRITE_TOKEN ? 'token' : 'none', options: {} };
}

/** Logs presence-only diagnostics; never tokens, headers or env values. */
export async function loadBlobPdf(
  get: BlobGet,
  pathname: string,
  request: Request,
  env: BlobEnv,
  log: (...args: unknown[]) => void = console.error,
): Promise<ReadableStream<Uint8Array> | null> {
  const { mode, options } = blobAuth(request, env);
  try {
    const blob = await get(pathname, { access: 'private', ...options });
    if (blob?.statusCode === 200 && blob.stream) return blob.stream;
    log('[cv] blob get', { statusCode: blob?.statusCode ?? null, pathname, auth: mode });
    return null;
  } catch (err) {
    const e = err as { name?: string; message?: string } | undefined;
    log('[cv] blob get failed', e?.name, e?.message, { auth: mode });
    throw err;
  }
}
