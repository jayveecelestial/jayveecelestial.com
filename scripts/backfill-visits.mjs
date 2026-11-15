// One-off: make vc:visits exact by summing the `visits` field of every vc:v:* hash.
// Dry run by default (prints the sum). `--write` raises vc:visits to it (never lowers, so reruns are safe).
// Credentials: UPSTASH_REDIS_REST_URL/TOKEN, else KV_REST_API_URL/TOKEN (same order as readCreds).
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  console.error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN).');
  process.exit(1);
}

async function redis(cmd) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const { result, error } = await res.json();
  if (error) throw new Error(error);
  return result;
}

// Atomic raise-only write: never lowers the counter.
const RAISE = "local c = tonumber(redis.call('GET', KEYS[1])) or 0; if tonumber(ARGV[1]) > c then redis.call('SET', KEYS[1], ARGV[1]) return ARGV[1] end return c";

async function* scan(match) {
  let cursor = '0';
  do {
    const [next, keys] = await redis(['SCAN', cursor, 'MATCH', match, 'COUNT', 500]);
    cursor = next;
    yield* keys;
  } while (cursor !== '0');
}

// SCAN may return a key more than once; count each hash once.
const keys = new Set();
for await (const key of scan('vc:v:*')) keys.add(key);

let sum = 0;
const all = [...keys];
for (let i = 0; i < all.length; i += 500) {
  const batch = all.slice(i, i + 500);
  const values = await redis(['EVAL', "local t = {} for i, k in ipairs(KEYS) do t[i] = redis.call('HGET', k, 'visits') or false end return t", batch.length, ...batch]);
  for (const v of values) sum += Number(v) || 0;
}

console.log(`visitors: ${all.length}, total visits: ${sum}`);
if (process.argv.includes('--write')) {
  const before = Number(await redis(['GET', 'vc:visits'])) || 0;
  const after = await redis(['EVAL', RAISE, 1, 'vc:visits', sum]);
  console.log(`vc:visits before: ${before}, after: ${after}`);
} else {
  console.log('Dry run. Pass --write to raise vc:visits.');
}
