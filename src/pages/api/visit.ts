import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { handleVisit, readCreds } from '../../lib/visit.ts';
import { hit } from '../../lib/visit-redis.ts';

export const prerender = false;

export const POST: APIRoute = (ctx) =>
  handleVisit(ctx.request, {
    vercelEnv: process.env.VERCEL_ENV,
    dev: import.meta.env.DEV,
    ...readCreds(getSecret),
    clientAddress: () => ctx.clientAddress,
    now: Date.now(),
    hit,
  });

export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
