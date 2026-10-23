# Site

Why: this is the public face of the agentic blog, built to be read first by a dyslexic reader and a
distracted one. Static pages, three depths per post, one colour reserved for the message, and a private
studio behind Cloudflare Access where every origin begins.

## Run locally

```
npm install            # from the repo root
npm run dev            # http://localhost:4321
npm run build          # astro check + build into site/dist
npm run pages:dev --workspace site   # the built site plus the functions, with local R2 and AI bindings
```

The functions skip the Access check on localhost. Everything else behaves as in production.

## Cloudflare setup (once)

1. **Pages project** `agentic-blog`, connected to this repo, root directory `site`, build command
   `cd .. && npm ci && npm run build`, output `site/dist`. Production branch `main`.
2. **Custom domain** `blog.victorsaly.com` on the Pages project. DNS on Cloudflare.
3. **R2 bucket** `agentic-blog-audio`; bind it as `AUDIO` (wrangler.toml already says so).
4. **Workers AI** binding `AI` (wrangler.toml).
5. **Secret** `GITHUB_TOKEN`: a fine-grained token on `victorsaly/agentic-blog` with *Contents: read and
   write* only. `npx wrangler pages secret put GITHUB_TOKEN --project-name agentic-blog`.
6. **Access**: Zero Trust → Access → Applications → self-hosted, domain `blog.victorsaly.com`, paths
   `/studio` and `/api/*`, policy *Allow* with your email. Nothing else needs a login.

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
