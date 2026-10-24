# Agentic blog — working rules

> Why: this file exists so that every agent and every person touching the repo builds under the same rules.
> It is read by Claude Code at the start of every session. Keep it short; put detail in the folder READMEs.

## What this is

A blog for blog.victorsaly.com where every post starts as a raw voice note (the **origin**) and every
published form (short, long, LinkedIn, another language, voice, image) is a **conversion** that links back
to it. The tagline is "Talked out loud, tidied by AI." Agents do the converting; a human decides.

The full idea is the first post: `thoughts/2026-10-23-converted-with-ai/`.

## Non-negotiables

1. **A raw file is never edited after it lands.** `thoughts/*/origin/**` is append-only. A correction is a new origin.
2. **Everything carries a why.** Every Markdown file in `thoughts/`, `wiki/` and `agents/` has `why:` in its
   front matter (one to three sentences). `npm run check:why` fails the build without it.
3. **Nothing publishes without a human merge.** Agents open pull requests. `main` is protected.
4. **Private by default.** `settings.yml → index: false` keeps robots out until Victor flips it.
5. **Accessibility is the floor.** WCAG 2.2 AA; axe runs in CI; keyboard reaches everything; one font switch.
6. **Monochrome.** Black on white (and white on black). One colour, marigold: on a post it marks the message,
   once; on a list page it marks each post's title; in search it marks the match. Drawings are linocut
   prints, inverted in dark mode.

## Stack

- Site: Astro 7 + React islands + TypeScript strict, in `site/`. Deployed as a Cloudflare Worker with static assets.
- Edge: functions in `site/functions/` compiled into the Worker (upload to R2, transcription via Workers AI).
- Login: Cloudflare Access in front of `/studio` (configured in the Cloudflare dashboard, not in code).
- Content: Markdown with YAML front matter in `thoughts/`, read by Astro content collections.
- Agents: TypeScript programs in `agents/`, one folder each, run by GitHub Actions on a label or a schedule.
- Models: Claude for reasoning agents and for reviewing every drawing; Workers AI for transcription; OpenAI's
  image model for drawings (Workers AI as the fallback without a key).

## Commands (run from the repo root)

```
npm install            # installs root + site workspaces
npm run dev            # Astro dev server
npm run build          # full build, runs check:why first
npm run lint           # ESLint + Prettier check
npm run typecheck      # tsc --noEmit for site and agents
npm run test           # Vitest
npm run check:why      # every content and agent file has a why
npm run agent -- <name> <thought-slug>   # run one agent locally
```

## Code standards

- TypeScript `strict`, no `any`, no non-null assertions; `unknown` at every boundary, narrowed with zod.
- Named exports only. One component per file. Files and folders in kebab-case; components in PascalCase.
- Functions small and pure where possible; side effects live at the edges (`functions/`, `agents/*/index.ts`).
- ESLint (typescript-eslint strict, react, jsx-a11y, astro) and Prettier are the law; CI runs both.
- Tests with Vitest next to the code (`*.test.ts`). Test behaviour, not implementation.
- Commits: Conventional Commits (`feat:`, `fix:`, `content:`, `agent:`, `chore:`). One concern per PR.
- No new dependency without a line in the PR saying why and what it replaces.

## Design rules

- Tokens live in `site/src/styles/tokens.css`. No hex values anywhere else.
- Type: Atkinson Hyperlegible by default; the switch goes to Lexend. Body 19px, line height 1.6, about 70 characters a line (the `--measure` token).
- Three depths on every post: **message** (2–3 lines, highlighted), **idea** (one screen), **road** (everything).
- No decoration. No shadows, no gradients, no cards. Structure is shown by spacing and ink rules in three
  weights: heavy (8px) opens a big moment, strong (3px) sits under a label or above a section, a hairline
  (1px) separates rows. Controls are one bordered box with an icon and a word, filled black when on.
- Motion only when the reader asked for it (opening, expanding). Respect `prefers-reduced-motion`.
- Before any UI work: run Impeccable and Emil Kowalski's `emil-design-eng`; run `/impeccable critique` before merge.

## Where things are

```
profile.md        who the blogger is and how they talk — every agent reads it first
settings.yml      site settings: domain, languages, themes, index switch
thoughts/         one folder per thought: origin/, structure.md, versions/, image/, sources.md, road.md
wiki/             drill-down pages for books and people
agents/           one folder per agent: PROMPT.md (why first) + index.ts
site/             the Astro app
scripts/          repo checks (why, front matter)
.github/          CI, deploy, agent workflows
docs/             skills.md: which skills to install and why
```
