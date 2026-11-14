export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const MAX_TOKEN_LENGTH = 2048;

export type Expect = { hostnames: string[]; action: string };
export type Verdict =
  | { ok: true }
  | { ok: false; kind: 'unavailable' | 'rejected'; reason: string };

const unavailable = (reason: string): Verdict => ({ ok: false, kind: 'unavailable', reason });
const rejected = (reason: string): Verdict => ({ ok: false, kind: 'rejected', reason });

/** Returns the token when it is a string of 1..2048 chars, else null. */
export function readToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.length >= 1 && value.length <= MAX_TOKEN_LENGTH ? value : null;
}

/** Judges a siteverify JSON response. Hostname/action are checked only when `expect` is given. */
export function judge(json: unknown, expect?: Expect): Verdict {
  if (typeof json !== 'object' || json === null) return unavailable('bad-response');
  const r = json as Record<string, unknown>;
  if (r.success !== true) {
    const codes = Array.isArray(r['error-codes']) ? r['error-codes'].join(',') : '';
    // Cloudflare-side fault, not the visitor's token.
    if (codes.includes('internal-error')) return unavailable(codes);
    return rejected(codes || 'rejected');
  }
  if (expect) {
    if (typeof r.hostname !== 'string' || !expect.hostnames.includes(r.hostname)) {
      return rejected('hostname-mismatch');
    }
    if (r.action !== expect.action) return rejected('action-mismatch');
  }
  return { ok: true };
}

export type VerifyInput = {
  token: string;
  secret: string;
  remoteip?: string;
  expect?: Expect;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** Verifies a Turnstile token with Cloudflare. Fails closed on any error. */
export async function verifyTurnstile({
  token,
  secret,
  remoteip,
  expect,
  fetchImpl = fetch,
  timeoutMs = 5000,
}: VerifyInput): Promise<Verdict> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body, signal: controller.signal });
    if (res.status !== 200) return unavailable('siteverify-status');
    return judge(await res.json(), expect);
  } catch {
    return unavailable('siteverify-unreachable');
  } finally {
    clearTimeout(timer);
  }
}
