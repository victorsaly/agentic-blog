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
- **Slice 2 is built** (`feat/roadbook-ledger`): every `npm run agent` run is recorded in
  `thoughts/<slug>/ledger.jsonl` with `ledger.head` beside it, and CI runs `roadbook verify-ledgers`. Cost
  comes from the usage Claude reports, priced from `agents/_lib/costs.ts`; a model with no price is refused
  before anything is spent. Known gap: the image agent's drawing calls (OpenAI, Workers AI) are not costed
  yet; its Claude review calls are. Slice 5's adapters close that.
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

- `agents/run.ts` appends `run.started`, `node.state`, `cost.incurred` and `node.output` (with a full
  `Receipt`) to `thoughts/<slug>/ledger.jsonl`, and saves `ledger.head` (count and last hash) beside it.
- The workflow in `.github/workflows/agents.yml` commits both with the agent's files.
- CI verifies every `ledger.jsonl` against its head (`Ledger.verify(events, head)`).
- Keep everything the runner does today: same exit codes (0 done, 3 held, 4 not implemented), same files.
- Done: running one agent locally adds events that verify; editing a past line of `ledger.jsonl` fails CI.
- Good for: Opus or Fable (touches the live pipeline; needs care with the existing logic).

### Slice 3: test sets that run

- `npm run roadbook -- test <agent>` runs each case in `agents/<agent>/tests/*.json` and checks the output
  against the card's `doneMeans`. Calls the model only with `--live`; without it, checks recorded outputs.
- Add test sets for the seven agents that have none (the RB060 warnings in `roadbook plan`).
- Done: `roadbook plan` shows no RB060 warning; a broken `doneMeans` check fails its test.
- Good for: Copilot for the test files; Opus or Fable for the runner.

### Slice 4: the disclosure on every post

- The post page reads `ledger.jsonl` and shows "How this was made" from `disclosure()`: which parts an
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

### Later (each needs its own plan before work starts)

- Runtime: one Cloudflare Agent (Durable Object) per run; gates become states the studio shows as
  "needs you".
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
