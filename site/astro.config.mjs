// Why: the site is static by default (fast, cheap, nothing running at night); React is only loaded on the
// pages that have an island; the sitemap is built but only served when settings.yml allows indexing.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const settings = parse(readFileSync(new URL('../settings.yml', import.meta.url), 'utf8'));
const domain = settings.site.domain;

export default defineConfig({
  site: `https://${domain}`,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [react(), sitemap()],
  server: { port: 4321 },
  vite: {
    // thoughts/ sits one level above the site so the content and the code share one history
    server: { fs: { allow: ['..'] } },
  },
});
