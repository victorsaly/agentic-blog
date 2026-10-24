// Why: the site is static by default (fast, cheap, nothing running at night); React is only loaded on the
// pages that have an island; the sitemap is built but only served when settings.yml allows indexing.
import { defineConfig, passthroughImageService } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { satteri } from '@astrojs/markdown-satteri';
import { sectionPictures } from './src/lib/section-pictures-plugin';
import { sectionDiagrams } from './src/lib/section-diagrams-plugin';
import { dropLeadHeading } from './src/lib/lead-heading-plugin';

const settings = parse(readFileSync(new URL('../settings.yml', import.meta.url), 'utf8'));
const domain = settings.site.domain;

export default defineConfig({
  site: `https://${domain}`,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  // The studio is private (behind Cloudflare Access) and never belongs in the sitemap.
  integrations: [
    react(),
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/studio') }),
  ],
  // The drawings are already small black-and-white PNGs; served as they are, no image library needed.
  image: { service: passthroughImageService() },
  // Each section's drawing goes under its heading in the long version (see the plugin's why).
  markdown: {
    processor: satteri({ mdastPlugins: [dropLeadHeading, sectionPictures, sectionDiagrams] }),
  },
  server: { port: 4321 },
  vite: {
    // thoughts/ sits one level above the site so the content and the code share one history
    server: {
      fs: { allow: ['..'] },
      // In development the reader chat's endpoint runs in the local Worker (npm run worker:dev, port 8787).
      proxy: { '/ask': 'http://localhost:8787' },
    },
  },
});
