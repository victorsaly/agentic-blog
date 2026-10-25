---
why: >
  The work on Agentic Roadbook continues across different agents (GitHub Copilot, Claude Opus, Fable) and
  sessions that do not share memory. This file is the shared memory: where the framework stands, what comes
  next in small slices, and how each slice is judged done, so any of them can pick up the next one cold.
---

# Agentic Roadbook: what's next

Read `CLAUDE.md` first (the repo's rules), then `packages/core/README.md` (the accountability rules and
where each lives). This file says what to build next and in what order.

## Where it stands (24 October 2026)

- **Slice 0 is built** (PR #44, `feat/roadbook-core`): `packages/core` (schema, rules RB001 to RB070,
  `plan`, the hash-chained ledger), `packages/cli` (`npm run roadbook -- validate | plan`),
  `roadbook.config.ts` (the blog as one Roadbook project) and an `agents/<name>/card.ts` per agent.
- The review fixes are in (commit 1c4959c): RB010 is checked from every node that makes work, RB032 counts
  only approve gates, RB043 covers fallback providers (`data.fallbackSends`), the ledger queues appends,
  copies events, verifies a cut end against a saved head, and the CLI never crashes on a bad config.
- **Slice 2 is built** (`feat/roadbook-ledger`): every `npm run agent` run is recorded in its own file,
  `thoughts/<slug>/ledger/<run>.jsonl` with `<run>.head` beside it, and CI runs `roadbook verify-ledgers`
  and refuses a pull request that changes or removes a merged run. One file per run (not one chain per
  thought) is what lets two branches run agents on the same thought and both merge.
- **Model adapters are built** (`feat/model-adapters`, most of Slice 5): every model call goes through one
  contract in `packages/core/src/models.ts` (an adapter that writes, draws or speaks and reports its usage
  in named meters). Adapters exist for `claude`, `openai-images`, `workers-ai` and `elevenlabs`; the runner
  picks them from the card's providers in order, and `agents/_lib/prices.ts` prices every meter, refusing an
  unpriced model before anything is spent. Image and voice calls are costed too (ElevenLabs by the
  characters it reports billing). Left for Slice 5: a card listing the writer it
  uses for review (the image agent reviews with `writer`, which its card does not name), and adapters for
  the other provider kinds.
- **Slice 4 is built** (`feat/disclosure-box`), split by Victor's decision: readers see "How this was made"
  after a post's sources (the agents that worked on it and what each does, any edit, part written by hand
  or override with its reason); the studio's "Runs and costs" shows every run of every post with how it
  ended, holds included, its cost in pounds, and the month against the budget. Both read `ledger/` at build
  time; a run that does not verify stops the build. A post with no runs shows no box.
- **The studio is split into areas** (PR #72, `feat/studio-areas`): `/studio` (Today), `talk`, `feedback`,
  `review`, `comments` and `runs`, each its own page under one layout with a tab row, full frame width.
  Slices 6 to 8 below build on it.
- **Nothing runs through Roadbook yet.** The agents still run through `agents/run.ts` and their
  `PROMPT.md`; the cards describe them alongside. That is deliberate: the existing logic keeps working
  while the framework grows under it.

## Decision (settled for Slice 1)

Victor chose the recommended approach: `card.ts` holds the agent facts, including phase, reads and writes;
`PROMPT.md` keeps the why and the instructions to the model. `roadbook check-cards` checks the shared
phase, reads and writes facts, and `/how-it-works` reads its roster from the cards.

## The slices

One slice per pull request, in this order. Each lists what "done" means; a slice is not done until CI is
green and every item below it holds.

### Slice 1: one source for agent facts

- `npm run roadbook -- check-cards` compares each `PROMPT.md` front matter (`phase`, `reads`, `writes`)
  with its card and prints each disagreement with the fix. CI runs it.
- `site/src/lib/agents.ts` reads workflow facts from cards and the agent's why from `PROMPT.md`
  (keep `rosterFrom` and its tests).
- Done: changing a card's phase without its `PROMPT.md` fails CI; /how-it-works still lists 13 agents.
- Good for: Copilot (well specified, mostly plumbing).

### Slice 2: the existing runner writes a ledger

- `agents/run.ts` records `run.started`, `node.state`, `cost.incurred` and `node.output` (with a full
  `Receipt`) in `thoughts/<slug>/ledger/<run>.jsonl`, and saves `<run>.head` (count and last hash) beside
  it. Reading and writing these lives in `@roadbook/core/node`, shared with the CLI.
- The workflow in `.github/workflows/agents.yml` commits both with the agent's files, and commits the
  ledger alone when the run failed.
- CI verifies every run against its head (`Ledger.verify(events, head)`), and fails a pull request that
  changes or removes a run already on the base branch.
- Keep everything the runner does today: same exit codes (0 done, 3 held, 4 not implemented), same files.
- Done: running one agent locally adds events that verify; editing a past line of a run fails CI.
- Good for: Opus or Fable (touches the live pipeline; needs care with the existing logic).

### Slice 3: test sets that run

- `npm run roadbook -- test <agent>` runs each case in `agents/<agent>/tests/*.json` and checks the output
  against the card's `doneMeans`. Calls the model only with `--live`; without it, checks recorded outputs.
- Add test sets for the seven agents that have none (the RB060 warnings in `roadbook plan`).
- Done: `roadbook plan` shows no RB060 warning; a broken `doneMeans` check fails its test.
- Good for: Copilot for the test files; Opus or Fable for the runner.

### Slice 4: the disclosure on every post

- The post page reads every run in `ledger/` and shows "How this was made" from `disclosure()`: which parts an
  agent wrote, which a person edited, any override and its reason. Nothing typed by hand.
- Monochrome, the house controls, WCAG 2.2 AA; run `/impeccable critique` before merge (CLAUDE.md).
- Done: a post with a ledger shows the box; a post without one shows nothing, not an empty box.
- Good for: Opus or Fable (UI and copy); Copilot for the data helper and tests.

### Slice 5: provider adapters that obey the card

- One interface for Claude, OpenAI images and Workers AI. Retries, the fallback, the budget and the timeout
  come from the card's `behaviour` and `budget`, not from each agent's code.
- Every call records `cost.incurred`; going over budget raises the card's escalation.
- Done: an agent's `index.ts` no longer chooses its provider; the image fallback goes through the adapter.
- Good for: Opus or Fable.

### The studio sees agents working (Slices 6 to 8)

Today a run is only visible after its pull request merges and the site deploys: the studio reads `ledger/`
at build time. The events that would show work in progress (`node.state`, `node.delta`, `gate.opened`,
`hold.raised`, `cost.incurred`) already exist; they sit in a file on a branch until the merge.

Decision (Victor, 25 October 2026): **git stays the record; a database is added for what is happening now.**

|          | What happened (the record)                      | What is happening now (live)                                |
| -------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Holds    | outputs, receipts, costs, the merge as approval | running, queued, which step, waiting on Victor, cost so far |
| Lives in | git: `ledger/` and the content (unchanged)      | D1: a projection of the ledger (new)                        |
| If lost  | must never be lost                              | rebuilt from git                                            |

The database never decides anything and never replaces a ledger file; the build keeps reading git. No new
vendor and no heavier database: the volume is a few dozen runs a day, and D1 already holds the comments.

#### Slice 6: an Agents area from GitHub (no new infrastructure)

- `/studio/agents`: a Worker endpoint asks the GitHub API, when the page opens, for the runs of
  `.github/workflows/agents.yml` and the open pull requests with an `agent:` label.
- Shows queued, running, done, held and failed, with the thought, the agent, how long it took, and links to
  the log and the pull request. Refreshes while the page is open; nothing moves but the numbers.
- Needs: the Worker's GitHub token gains **Actions: read** (Victor changes it in GitHub; open question).
- Done: a label added to a pull request shows as queued, then running, on the page within a minute,
  without a deploy; with the token missing the area says so in plain words instead of showing nothing.
- Good for: Opus or Fable (UI); Copilot for the endpoint and its tests.

#### Slice 7: the runner reports as it goes (D1)

**7a is built** (`feat/live-runs`): the core `Ledger` takes an `onAppend` listener; `agents/_lib/live.ts`
sends each event to `POST /api/runs/:id/events`, which checks every event's hash, its place and the chain
before keeping it (`site/src/lib/live-runs.ts`), and keeps the run's row in the same transaction;
`migrations/0002_runs.sql` adds the tables; `npm run live:rebuild` refills them from the ledgers. Setup for
the live site is in `site/README.md`, step 8. **7b, first half, is built**
(`feat/live-board`): `GET /api/runs` and `GET /api/runs/:id?after=` read the tables; the Agents page leads
with the board (needs you, running now, held, recently finished; a run silent for ten minutes shows as
quiet, not running) and each run opens on `/studio/agents/run?id=`, its timeline event for event, asking
for what is new every three seconds while it runs. **Next, the second half**: the pipeline read live instead
of at deploy, and one "needs you" list on Today. The runner does not stream text yet (`node.delta`); the
timeline already joins it into one line when it does.

- `agents/run.ts` sends each ledger event, as it appends it, to `POST /api/runs/:id/events`. The Worker
  checks the hash chain before storing (an event whose `prev` does not match the last one is refused).
  A send that fails never fails the run: the ledger file is still the record.
- GitHub Actions calls through a Cloudflare Access service token, so `/api/*` keeps its one gate.
- A new migration adds `runs` (one row per run: thought, agent, state, cost so far, started, ended, the
  commit once merged) and `run_events`. On merge the row is marked recorded and linked to the commit.
- `roadbook rebuild-live` (or a script) rebuilds both tables from `ledger/`, so losing them costs nothing.
- The studio:
  - **Agents**: running now, needs you, held, recently done; open a run for its timeline as it happens,
    the streamed text included. Updated by polling or server-sent events.
  - **Pipeline**: one row per thought, one column per phase from the cards, each cell the state of that
    step. This is the view that shows the blog working.
  - **Today**: one "needs you" list across review, comments, holds and agents' questions, with counts on
    the tabs.
- Monochrome and still: states are words and filled or empty marks, elapsed time ticks as numbers, no
  decorative motion (CLAUDE.md: motion only when the reader asked for it).
- Done: a local run (`npm run agent`) appears on the board within seconds and its timeline matches its
  ledger file event for event; deleting the tables and rebuilding gives the same board; an event with a
  broken chain is refused with a plain message.
- Good for: Opus or Fable (touches the runner and adds an endpoint that writes).

#### Slice 8: questions that wait (needs its own plan first)

This is the runtime under Later, made concrete by what Slice 7 shows Victor actually wants to answer.

- One Cloudflare Agent (Durable Object) per run. On `gate.opened` the run pauses; Victor answers in the
  studio; `gate.closed` records who decided and the run goes on. Today a question can only end in a hold.
- Start an agent from the studio ("run structure on this thought") instead of a pull request label.
- WebSockets from the run to the studio, replacing polling.
- Check first: Durable Objects may need the Workers Paid plan; agents moving from Actions to Workers
  changes where secrets and time limits live.

### Later (each needs its own plan before work starts)

- Runtime: one Cloudflare Agent (Durable Object) per run; gates become states the studio shows as
  "needs you". Slice 8 is its first step.
- `roadbook build` and `deploy` for the owner's own Cloudflare account.
- The builder and an MCP server, so Claude can edit a project through `validate`.
- The second project on the framework: bug fixing.

## Rules for any agent picking up a slice

- Branch from `main` once #44 is merged (from `feat/roadbook-core` until then). Name it
  `feat/roadbook-<slice>`. Conventional Commits. One slice per pull request, using the PR template.
- TypeScript strict, no `any`, no non-null assertions, `unknown` at boundaries narrowed with zod. Named
  exports. Tests next to the code.
- A rule never gets an off switch. A new rule gets an `RBxxx` id, a plain message, a fix, and a test
  showing the project it refuses.
- Never edit anything under `thoughts/*/origin/`. Every new Markdown file starts with a `why:`.
- No new dependency without a line in the PR saying why and what it replaces.
- Before asking for review: `npm run lint && npm run typecheck && npm run test && npm run check:why` and
  `npm run roadbook -- validate`.
- Agents open pull requests; a person merges. Never merge your own.

## Small follow-ups outside the framework

From the /how-it-works critique (`.impeccable/critique/`), not yet done:

- Reader text on /how-it-works still says "convert" (a tour chip, a chart node, an agent row) and the
  profile agent's why says "converted"; PRODUCT.md asks for plain words.
- The agent list on /how-it-works is sorted by name within a phase, not in the order agents run.
- With the voice off, the tour announces only the station name to screen readers, not the spoken line.
- The tour's Voice toggle is filled black when on and competes with Play.
