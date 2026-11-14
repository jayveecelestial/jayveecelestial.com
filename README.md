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
| `npm run preview` | Serve the built site locally                          |
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
