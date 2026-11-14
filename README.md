# jayveecelestial.com

"Night Shift": an interactive pixel-art portfolio. A canvas game runs over real HTML content, and a plain CV view shows the same content without the game.

Live: https://jayveecelestial.com

## Commands

Node version: see `engines` in `package.json`. `.npmrc` sets `legacy-peer-deps=true`.

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm install`     | Install dependencies                                  |
| `npm run dev`     | Dev server at `localhost:4321`                        |
| `npm run build`   | Build the site to `dist/`                             |
| `npm run preview` | Not supported with the Vercel adapter (use `dev`)    |
| `npm run test`    | Unit tests (`node --test`) for the game code          |

## Views

- Plain view: `/?view=plain`
- Back to the game: `/?view=play`
- The choice is saved in `localStorage` under `ng-mode`. Without a `view` param, the saved choice is used. The default is the game.

## Layout

- `src/pages/index.astro`: home page. Renders the CV content as HTML and the game stations and quest tracker.
- `src/pages/404.astro`: "Page not found" page.
- `src/layouts/Base.astro`: shared page frame (head, fonts, styles, skip link, footer, analytics).
- `src/data/profile.ts`: all CV content (email, links, experience, certs, skills, stats).
- `src/lib/visit.ts`: visitor counter logic (validation, bot filter, gate, `handleVisit`). `src/lib/visit-redis.ts` holds the Redis script. `src/pages/api/visit.ts` is the thin route.
- `src/styles/global.css`: global styles and the colour palette. Sprites read colours from here.
- `src/game/boot.ts`: starts the game in the browser, handles the view toggle, tutorial and quest storage.
- `src/game/state.ts`: game state and update step (movement, jump, mode resolution).
- `src/game/world.ts`: room size, stations, camera and hit tests.
- `src/game/input.ts`: keyboard, pointer and touch input.
- `src/game/render.ts`: canvas drawing and speech bubbles.
- `src/game/sprites.ts`: pixel-art sprites and palette keys.
- `src/game/quest.ts`: the 3-task visitor quest (work, certs, contact) and its progress logic.
- `src/game/game.test.ts`: unit tests for the game code.
- `src/assets/`: images processed by Astro (`avatar.webp`, `hero.png`).
- `public/`: static files (icons, avatar, social preview image, `robots.txt`, CV PDF).
- `vercel.json`: Vercel config (security headers and CSP).

## Editing content

- CV text and links: `src/data/profile.ts`.
- CV PDF: replace `public/Jayvee-Celestial-CV.pdf`. Keep the file name, or update the "CV (PDF)" link in `profile.ts`.

## Deploy

Merge to `main`. Vercel deploys automatically. Security headers and the CSP are in `vercel.json`.

## Visitor counter

The home page shows `VISITOR #n · VISIT x · y VISITORS`. It is backed by Upstash Redis (free plan, added through the Vercel Marketplace).

- Env vars: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The `KV_REST_API_URL` and `KV_REST_API_TOKEN` names also work. `UPSTASH_*` wins if both are set.
- On only when credentials exist and `VERCEL_ENV=production` (or `npm run dev`). Adding or changing credentials needs a redeploy, because the gate is evaluated at build. Previews and local builds render no widget and send no request. The route answers 204 when disabled.
- Local dev: put the two vars in `.env` and point them at a separate Upstash database, never the production one.
- `POST /api/visit` with `{"id":"<uuid v4>"}` returns `{n, visits, total}`. A visit counts again only after 30 minutes away. Each IP can create at most 10 new visitor numbers and send 120 requests per day (429 beyond that). In production only `https://jayveecelestial.com` and `https://www.jayveecelestial.com` origins are accepted. Bots are not counted.
- Redis keys: `vc:total` (unique visitors), `vc:v:<id>` (hash with `n`, `visits`, `last`), `vc:ip:<hash>` and `vc:rl:<hash>` (daily cap counters, expire after 24 hours).
- `npm run preview` is not supported with the `@astrojs/vercel` adapter. Use `npm run dev`.

Privacy: the browser stores a random id in `localStorage` (`ng-visitor`). The server keeps the IP only as a daily key, an HMAC-SHA256 with a server secret (the Upstash token), that expires after 24 hours. No personal data is stored. The strip has a tooltip saying so.
