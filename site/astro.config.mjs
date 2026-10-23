// Why: the site is static by default (fast, cheap, nothing running at night); React is only loaded on the
// pages that have an island; the sitemap is built but only served when settings.yml allows indexing.
import { defineConfig, passthroughImageService } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { satteri } from '@astrojs/markdown-satteri';
import { sectionPictures } from './src/lib/section-pictures-plugin';

const settings = parse(readFileSync(new URL('../settings.yml', import.meta.url), 'utf8'));
const domain = settings.site.domain;

export default defineConfig({
  site: `https://${domain}`,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [react(), sitemap()],
  // The drawings are already small black-and-white PNGs; served as they are, no image library needed.
  image: { service: passthroughImageService() },
  // Each section's drawing goes under its heading in the long version (see the plugin's why).
  markdown: { processor: satteri({ mdastPlugins: [sectionPictures] }) },
  server: { port: 4321 },
  vite: {
    // thoughts/ sits one level above the site so the content and the code share one history
    server: { fs: { allow: ['..'] } },
  },
});
