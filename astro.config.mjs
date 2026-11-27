// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://jayveecelestial.com',
  integrations: [sitemap()],
  adapter: vercel(),
  // Never inline stylesheets either, so the CSP can drop 'unsafe-inline' from style-src.
  build: { inlineStylesheets: 'never' },
  vite: {
    build: {
      // Never inline scripts into the HTML, so the CSP can drop 'unsafe-inline' from script-src.
      // Other assets keep Astro's default limit (undefined falls back to it).
      assetsInlineLimit: (filePath) => (filePath.endsWith('.js') ? false : undefined),
    },
  },
  env: {
    schema: {
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
