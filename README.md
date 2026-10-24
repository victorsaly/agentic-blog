# Agentic blog

The engine behind **blog.victorsaly.com**: a blog where every post starts as a raw voice note and every
published version links back to it.

> **Talked out loud, tidied by AI.** The thought is real and stays the writer's. AI helps tidy it and give
> it structure, so anyone can say what they think freely and still publish a clear, well-documented blog.
> Every post has a switch to its original, kept exactly as it came out.

## How a thought moves

```
voice note ──▶ origin (audio + transcript, never edited)
                 │
                 ▼
           interview agent asks what a reader needs; I answer by voice
                 │
                 ▼
           structure agent: message · idea · road · small ideas · tags
                 │
     ┌───────────┼───────────┬──────────────┬──────────────┐
     ▼           ▼           ▼              ▼              ▼
  convert     image      citations     drill-down       voice
 (short,    (lines &     (doors out)   (wiki pages)   (read aloud)
  long,      dots)
  langs)
                 │
                 ▼
           safety + security hold anything that should not leave
                 │
                 ▼
           a pull request · I read, fix, merge · published with the badge
```

Every file an agent writes starts with its **why**. Every origin stays exactly as it was spoken.
The first post, `thoughts/2026-10-23-converted-with-ai/`, is the idea itself, built this way.

## Three depths

Every post is readable at three depths, so a reader gets the point first and goes deeper only if they want:

1. **The message**: two or three lines, highlighted.
2. **The idea**: one screen, plain words.
3. **The road**: the full piece, the origin, the conversion notes, the sources.

## Layout

```
profile.md        who the blogger is and how they talk — every agent reads it first
settings.yml      domain, languages, themes, the index switch
thoughts/         one folder per thought
  <date-slug>/
    origin/       transcript.md (+ audio key in R2), answers.md — append-only
    structure.md  message, idea, road, small ideas with tags, why
    versions/     short.md, long.md, linkedin.md, <lang>.md — each: converted_from + why
    image/        the picture and its prompt
    sources.md    citations, each reviewed
    feedback/     my notes about the output, dated
    road.md       which agents ran, in which order, with which prompts
wiki/             drill-down pages
agents/           one folder per agent: PROMPT.md + index.ts
site/             Astro + React, Cloudflare Pages
scripts/          repo checks
.github/          CI, deploy, agents
```

## Run it

```
npm install
npm run dev          # site at http://localhost:4321
npm run build        # checks every why, then builds
npm run lint && npm run typecheck && npm run test
```

Cloudflare: the site deploys to Pages from `main`; `/studio` sits behind Cloudflare Access; audio lives in R2;
transcription runs on Workers AI. See `site/README.md` for bindings and `agents/README.md` for the agents.

## Licence

Code: MIT. Content under `thoughts/` and `wiki/`: all rights reserved until a licence is chosen (see `settings.yml`).
