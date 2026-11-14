export const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const BOT_RE = /bot|crawl|spider|headless|lighthouse|preview/i;
const ORIGINS = ['https://jayveecelestial.com', 'https://www.jayveecelestial.com'];
const MAX_BODY_BYTES = 256;

export type Visit = { n: number; visits: number; total: number };

export type VisitDeps = {
  vercelEnv: string | undefined;
  dev: boolean;
  url: string | undefined;
  token: string | undefined;
  /** Lazy: Astro's clientAddress getter throws when the platform gives none. */
  clientAddress: () => string;
  now: number;
  /** Resolves to null when a per-IP cap blocks the request. Throws on Redis failure. */
  hit: (args: { url: string; token: string; id: string; ipKey: string; now: number }) => Promise<Visit | null>;
};

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

export function isBot(ua: string | null | undefined): boolean {
  return !!ua && BOT_RE.test(ua);
}

export function counterEnabled(o: {
  vercelEnv: string | undefined;
  dev: boolean;
  url: string | undefined;
  token: string | undefined;
}): boolean {
  return !!o.url && !!o.token && (o.vercelEnv === 'production' || o.dev);
}

/** UPSTASH_* wins over KV_* (same order as @upstash/redis fromEnv). */
export function readCreds(get: (k: string) => string | undefined): { url: string | undefined; token: string | undefined } {
  return {
    url: get('UPSTASH_REDIS_REST_URL') ?? get('KV_REST_API_URL'),
    token: get('UPSTASH_REDIS_REST_TOKEN') ?? get('KV_REST_API_TOKEN'),
  };
}

export function parseVisit(json: unknown): Visit | null {
  if (typeof json !== 'object' || json === null) return null;
  const { n, visits, total } = json as Record<string, unknown>;
  if (!Number.isInteger(n) || !Number.isInteger(visits) || !Number.isInteger(total)) return null;
  const v = { n: n as number, visits: visits as number, total: total as number };
  if (v.n < 1 || v.visits < 1 || v.n > v.total) return null;
  return v;
}

export function formatVisit(v: Visit): { n: string; visits: string; total: string } {
  const f = new Intl.NumberFormat('en-US');
  return { n: f.format(v.n), visits: f.format(v.visits), total: f.format(v.total) };
}

/** Rate-limit key for an IP: IPv4 as is, IPv4-mapped IPv6 as IPv4, other IPv6 as its /64 prefix. */
export function ipPrefix(ip: string): string {
  const addr = ip.trim().toLowerCase().split('%')[0] ?? '';
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (mapped) return mapped[1] as string;
  if (!addr.includes(':')) return addr;
  const halves = addr.split('::');
  if (halves.length > 2) return addr;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  const groups = [...head, ...Array<string>(Math.max(fill, 0)).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return addr;
  return groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':');
}

/** First 16 hex chars of HMAC-SHA256(secret, ip|day). The raw IP is never stored. */
export async function ipKey(ip: string, day: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${ip}|${day}`));
  let hex = '';
  for (const b of new Uint8Array(mac).subarray(0, 8)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function empty(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handleVisit(request: Request, deps: VisitDeps): Promise<Response> {
  if (request.method !== 'POST') return empty(405, { Allow: 'POST' });

  const { url, token } = deps;
  if (!url || !token || !counterEnabled({ ...deps, url, token })) return empty(204);

  if (deps.vercelEnv === 'production' && !ORIGINS.includes(request.headers.get('origin') ?? '')) {
    return empty(403);
  }

  if (isBot(request.headers.get('user-agent'))) return empty(204);

  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return json(400, { error: 'bad request' });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json(400, { error: 'bad request' });
  let id: unknown;
  try {
    id = (JSON.parse(text) as { id?: unknown } | null)?.id;
  } catch {
    return json(400, { error: 'bad request' });
  }
  if (!isValidId(id)) return json(400, { error: 'bad request' });

  try {
    const day = new Date(deps.now).toISOString().slice(0, 10);
    const key = await ipKey(ipPrefix(deps.clientAddress()), day, token);
    const result = await deps.hit({ url, token, id, ipKey: key, now: deps.now });
    if (!result) return json(429, { error: 'too many requests' });
    return json(200, result);
  } catch {
    return json(503, { error: 'unavailable' });
  }
}
