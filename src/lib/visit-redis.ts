import { parseVisit, type Visit, type VisitDeps } from './visit.ts';

const WINDOW_MS = 30 * 60 * 1000;
const NEW_PER_IP_PER_DAY = 10;
const REQUESTS_PER_IP_PER_DAY = 120;

// KEYS: total counter, visitor hash, per-IP new-visitor counter, per-IP request counter, total visits counter.
// ARGV: now (ms), revisit window (ms), new visitors per IP per day, requests per IP per day.
// Returns {n, visits, total, totalVisits}; {0, 0, 0, 0} when an IP cap blocks the request.
// A visit exists whenever a reply is returned, so the total visits is at least 1 even before the backfill.
export const SCRIPT = `
local r = redis.call('INCR', KEYS[4])
if r == 1 then redis.call('EXPIRE', KEYS[4], 86400) end
if r > tonumber(ARGV[4]) then return {0, 0, 0, 0} end
local n = redis.call('HGET', KEYS[2], 'n')
if not n then
  local c = redis.call('INCR', KEYS[3])
  if c == 1 then redis.call('EXPIRE', KEYS[3], 86400) end
  if c > tonumber(ARGV[3]) then return {0, 0, 0, 0} end
  local t = redis.call('INCR', KEYS[1])
  redis.call('HSET', KEYS[2], 'n', t, 'visits', 1, 'last', ARGV[1])
  return {t, 1, t, redis.call('INCR', KEYS[5])}
end
local visits = tonumber(redis.call('HGET', KEYS[2], 'visits'))
local tv
if tonumber(ARGV[1]) - tonumber(redis.call('HGET', KEYS[2], 'last')) >= tonumber(ARGV[2]) then
  visits = redis.call('HINCRBY', KEYS[2], 'visits', 1)
  redis.call('HSET', KEYS[2], 'last', ARGV[1])
  tv = redis.call('INCR', KEYS[5])
else
  tv = math.max(tonumber(redis.call('GET', KEYS[5])) or 0, 1)
end
return {tonumber(n), visits, tonumber(redis.call('GET', KEYS[1])), tv}
`;

export const hit: VisitDeps['hit'] = async ({ url, token, id, ipKey, now }) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', SCRIPT, 5, 'vc:total', `vc:v:${id}`, `vc:ip:${ipKey}`, `vc:rl:${ipKey}`, 'vc:visits', now, WINDOW_MS, NEW_PER_IP_PER_DAY, REQUESTS_PER_IP_PER_DAY]),
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const { result } = (await res.json()) as { result?: unknown };
  if (!Array.isArray(result) || result.length !== 4) throw new Error('redis bad reply');
  const [n, visits, total, totalVisits] = result as number[];
  if (n === 0) return null;
  const v: Visit | null = parseVisit({ n, visits, total, totalVisits });
  if (!v) throw new Error('redis bad reply');
  return v;
};
