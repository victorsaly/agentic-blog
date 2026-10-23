---
why: >
  Several agents, one job each, one profile they all read, and a human at the start and at the end. This file
  says how to run one and what each is for.
---

# Agents

Several agents, one job each, one profile they all read, and a human at the start and at the end.
Each lives in its own folder with a `PROMPT.md` that starts with its why and an `index.ts` that only
gathers inputs and names outputs. The prompt is the behaviour; the code is plumbing.

## Run one

```
ANTHROPIC_API_KEY=… npm run agent -- interview 2026-10-23-converted-with-ai
```

The runner (`run.ts`) loads `settings.yml`, `profile.md`, the agent's prompt and the thought folder, asks
the model with the profile in the system message, and writes what the agent returns. It refuses to write
under `origin/` and refuses any file without a why. Exit codes: 0 done, 3 held, 4 not implemented.

In GitHub Actions the same command runs on a label (`agent:<name>`) or a schedule, and the workflow turns
the written files into a pull request. See `.github/workflows/agents.yml`.

## The roster

| Agent     | One job                                                                        | Phase | Code |
| --------- | ------------------------------------------------------------------------------ | ----- | ---- |
| interview | asks what a reader would need, and asks about the blogger                      | 1     | real |
| structure | message, idea, road, small ideas, tags                                         | 2     | real |
| convert   | short, long, posts, languages                                                  | 2     | real |
| safety    | reads everything that leaves for hate or harm; can hold                        | 5     | real |
| profile   | learns how the blogger talks and what they accept                              | 3     | real |
| image     | one picture in the house style                                                 | 4     | real |
| citations | finds what each claim rests on, links out                                      | 4     | real |
| drilldown | wiki pages for books and people                                                | 4     | real |
| feedback  | turns a note about the output into a rework, and a pattern into a route change | 5     | real |
| security  | patches, and other people's data; can hold                                     | 5     | real |
| seo       | metadata when the index switch is on                                           | 5     | real |
| publish   | assembles the pull request, confirms the badge                                 | 5     | real |

All twelve have code. citations and drilldown search the web through Claude's web search tool (no extra
key). image draws with OpenAI's image model when `OPENAI_API_KEY` is set (`OPENAI_IMAGE_MODEL` overrides
the model), otherwise with Cloudflare Workers AI, which needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_TOKEN`
(a token with "Workers AI: Read"); without them it writes `image/prompt.md` and stops. It also needs
`ffmpeg` on the path to force every pixel to black or white; GitHub's Ubuntu runners have it.

## Rules every agent obeys

1. Nothing is written under `origin/`. Ever. The runner throws.
2. Every file carries a `why:` of at least a sentence. The runner throws.
3. Nothing is published by an agent. A pull request is the end of every run.
4. Every agent reads `profile.md` first and writes towards the blogger, not towards the average of the internet.
5. An agent adds no facts the blogger did not say. What it adds (a caveat, a cut) goes in the why.
