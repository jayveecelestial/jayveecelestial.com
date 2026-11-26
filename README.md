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
| `npm run test:e2e` | Browser tests (Playwright) against the built site. Run `npm run build` first. |

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
- `src/game/title.ts`: when the first-visit title card shows (`#title` in `index.astro`). It replaces the first "How to play" popup and is skipped for returning visitors (`ng-tutorial` in `localStorage`), `?view=play`, `?view=plain` and deep links such as `/#work`.
- `src/game/game.test.ts`: unit tests for the game code.
- `src/assets/`: images processed by Astro (`avatar.webp`, `hero.png`).
- `public/`: static files (icons, avatar, social preview image, `robots.txt`).
- `src/pages/api/cv.ts`: `POST /api/cv`, the Turnstile-gated CV download. Logic lives in `src/lib/cv-route.ts` and `src/lib/turnstile.ts`.
- `vercel.json`: Vercel config (security headers and CSP).

## Editing content

- CV text and links: `src/data/profile.ts`.
- Notes: Markdown files in `src/content/notes/` become `/notes/<file-name>` and are listed at the end of the Work section. Frontmatter: `title`, `summary`, `date`, `draft`. Drafts build in dev and Vercel previews (with `noindex`), never in production. Set `draft: false` to publish.
- CV PDF: see the next section. The PDF is not in `public/`.

## CV download

The CV PDF is private. Visitors pass a Cloudflare Turnstile check, then the page posts to `POST /api/cv`, which streams the file.

- Production: the file lives in the Vercel Blob private store at `cv/Jayvee-Celestial-CV.pdf`. Upload a new version to that path. No redeploy needed.
- Previews and any other non-production environment return 503 (fail closed). Only `VERCEL_ENV=production` reads the Blob.
- Local dev: put the PDF at `private/Jayvee-Celestial-CV.pdf` (gitignored) and copy `.env.example` to `.env`. It holds Turnstile test keys that always pass.
- Env vars: `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `BLOB_STORE_ID` (set automatically when the Blob store is connected to the project).
- The old URL `/Jayvee-Celestial-CV.pdf` redirects to `/#contact`.

## Deploy

Merge to `main`. Vercel deploys automatically. Security headers and the CSP are in `vercel.json`.

- CI: `.github/workflows/ci.yml` runs `npm audit --audit-level=high`, `npm test` and `npm run build`, then the browser tests in Chromium, Firefox, WebKit and a mobile Chromium profile, on every pull request and on pushes to `main`.
- Browser tests: `e2e/site.spec.ts`. They serve the built site with `scripts/serve-static.mjs`, which applies the headers from `vercel.json`, so CSP violations and console errors fail a test. Accessibility checks (axe, WCAG 2.2 AA, serious and critical findings) run in Chromium only. First time locally: `npx playwright install`.
- Dependabot (`.github/dependabot.yml`) opens weekly update PRs for npm packages and GitHub Actions.
- The CSP allows no inline scripts. `astro.config.mjs` stops Astro from inlining small scripts into the HTML, so every script ships as a file under `/_astro/`. Don't add inline script code or inline event handlers; they will be blocked in production. The one `is:inline` tag, in `index.astro`, only loads `public/mode.js` by URL: it picks the game or plain layout before the first paint so the page doesn't jump (keep it in step with `resolveMode` in `src/game/state.ts`).

## Visitor counter

The home page shows `YOU'RE VISITOR #n · 1ST VISIT | y VISITORS · z VISITS TOTAL` (`VISIT x` after the first visit; "You're" and "total" are hidden under 600px). It is backed by Upstash Redis (free plan, added through the Vercel Marketplace).

- Env vars: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The `KV_REST_API_URL` and `KV_REST_API_TOKEN` names also work. `UPSTASH_*` wins if both are set.
- On only when credentials exist and `VERCEL_ENV=production` (or `npm run dev`). Adding or changing credentials needs a redeploy, because the gate is evaluated at build. Previews and local builds render no widget and send no request. The route answers 204 when disabled.
- Local dev: put the two vars in `.env` and point them at a separate Upstash database, never the production one.
- `POST /api/visit` with `{"id":"<uuid v4>"}` returns `{n, visits, total, totalVisits}`. `visits` is this visitor's own count, `totalVisits` is the site-wide count. A visit counts again only after 30 minutes away. Each IP can create at most 10 new visitor numbers and send 120 requests per day (429 beyond that). In production only `https://jayveecelestial.com` and `https://www.jayveecelestial.com` origins are accepted. Bots are not counted.
- Redis keys: `vc:total` (unique visitors), `vc:visits` (site-wide total visits, incremented exactly where a visit counts), `vc:v:<id>` (hash with `n`, `visits`, `last`), `vc:ip:<hash>` and `vc:rl:<hash>` (daily cap counters, expire after 24 hours).
- Backfill: `vc:visits` starts empty, so run `node scripts/backfill-visits.mjs` once after deploying. It scans `vc:v:*`, sums the `visits` fields and prints the sum (dry run). Add `--write` to raise `vc:visits` to the sum. The write is one atomic raise-only EVAL (it never lowers the counter) and prints the before and after values, so reruns are safe. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*` names) in the environment first. Visits counted between the scan and the write can leave the counter slightly low; rerun the script to correct it. Never put a TTL on `vc:v:*` hashes: the backfill sum relies on them living forever.
- `npm run preview` is not supported with the `@astrojs/vercel` adapter. Use `npm run dev`.

Privacy: the browser stores a random id in `localStorage` (`ng-visitor`). The server keeps the IP only as a daily key, an HMAC-SHA256 with a server secret (the Upstash token), that expires after 24 hours. No personal data is stored. The strip has a tooltip saying so.
