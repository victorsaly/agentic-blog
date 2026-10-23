# Site

Why: this is the public face of the agentic blog, built to be read first by a dyslexic reader and a
distracted one. Static pages, three depths per post, one colour reserved for the message, and a private
studio behind Cloudflare Access where every origin begins.

## Run locally

```
npm install            # from the repo root
npm run dev            # http://localhost:4321
npm run build          # astro check + build into site/dist
npm run worker:dev --workspace site  # the built site plus the API, with local R2 and AI bindings
```

The functions skip the Access check when `DEV_SKIP_ACCESS=1` is set in `site/.dev.vars` (copy
`.dev.vars.example`). The hostname cannot tell local from production, because wrangler dev rewrites every
request to the custom domain. Everything else behaves as in production.

## Cloudflare setup (once)

The site deploys as a **Worker with static assets** (`site/wrangler.jsonc`), not as a Pages project.

1. **R2**: enable R2 on the account (dashboard → R2 → Enable), then create the bucket `agentic-blog-audio`
   (or let the Cloudflare connector do it). It is bound as `AUDIO`.
2. **Workers AI** is bound as `AI`; nothing to create.
3. **Secrets**, from `site/`: `npx wrangler secret put GITHUB_TOKEN` (a fine-grained token on this repo,
   *Contents: read and write* only). In GitHub, add `CLOUDFLARE_API_TOKEN` (Workers Scripts: edit, DNS: edit
   on victorsaly.com, Workers R2: read) and `CLOUDFLARE_ACCOUNT_ID` as repository secrets for the deploy.
4. **Domain**: `wrangler.jsonc` claims `blog.victorsaly.com` as a custom domain; the first deploy creates the
   DNS record. Remove any CNAME you added by hand first, or the deploy refuses with a conflict.
5. **Access**: Zero Trust → Access → Applications → self-hosted, domain `blog.victorsaly.com`, paths
   `/studio` and `/api/*`, policy *Allow* with your email. Nothing else needs a login.
6. Local: `npm run worker:dev --workspace site` runs the built site with local R2 and AI bindings.

## Where things are

```
src/content.config.ts   three collections read straight from ../thoughts
src/layouts/Page.astro  fonts, theme and font switches, robots, skip link
src/pages/              index, thoughts/[slug], thoughts/[slug]/origin, studio, 404, robots.txt
src/components/         Header, Footer, Badge, Depth
src/islands/            Recorder, FeedbackStudio (React, only on the studio page)
src/lib/                settings (settings.yml), content helpers (tested)
src/styles/             tokens.css (every colour and size), base.css (everything else)
functions/              Pages Functions: upload, transcribe, audio, origin; _middleware is the Access gate
```

## Design rules, short

- Black on white, white on black. Marigold only behind the message.
- Atkinson Hyperlegible, 19px, line height 1.6, 60 characters a line. The switch goes to Lexend.
- Three depths on every post. The idea is open; the road and the origin are a click away.
- No cards, shadows, gradients or decoration. Rules and space show structure.
- Nothing moves unless the reader asked for it. `prefers-reduced-motion` is respected.
- Before UI work: Impeccable and `emil-design-eng`; before merge: `/impeccable critique` and `break-ui`.
