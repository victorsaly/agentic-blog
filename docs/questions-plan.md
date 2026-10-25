---
why: >
  Slice 8 is where the studio stops only watching agents and starts answering them: a question waits for
  Victor, he answers in the studio, and the work goes on. It touches the runner, the ledger and where agents
  run, so it needs a plan before code. This file says what is built first, in small slices, what is left
  for later and why, and how each slice is judged done, so any session can pick up the next one cold.
---

# Questions that wait (Slice 8): what's next

Read `CLAUDE.md` first, then `docs/roadbook-plan.md` (Slices 6 and 7: how a run reports live). The
workflow this slice makes live is `blog-post` in `roadbook.config.ts`.

## Where it stands (25 October 2026)

- **Slice 7 is done** (#82, #96, #99). Every run sends its ledger events to the studio as it records them.
  The Agents board, each run's timeline, the live pipeline and Today's "From the agents" list read them.
- **The workflow already has gates**, declared but not live. `answers` comes after `interview` ("Answer the
  questions a reader would ask"). `message` comes after `structure` ("Is this the message?"). `merge` comes
  after `publish`. Today each gate is handled by hand, in git:
  - Victor writes `origin/answers.md`.
  - He reads `structure.md`.
  - He adds the next `agent:` label to the pull request.
    No ledger records that a gate opened, or who closed it.
- **The ledger already has the words**: `gate.opened` (node, asks, question), `gate.closed` (decision, by),
  `feedback.given`, `override.given`, and the node state `needs-you`. Nothing writes them yet.
  `Ledger.resume` can continue a saved run.
- **A run is one agent on one thought, on GitHub Actions** (or `npm run agent` locally). Agents read the
  thought from disk and their files land as a commit on the pull request branch. That is why moving agents
  off Actions is the expensive part, not the waiting.
- **The studio can already ask GitHub to do things**: `POST /api/origin` sends a `repository_dispatch` with
  the Worker's token (Contents: write), and a workflow writes the files. The answer path below copies that.

## What Cloudflare offers (checked 25 October 2026 in the Cloudflare docs)

- **Durable Objects run on the Workers Free plan**, SQLite-backed only, with daily row limits (100,000
  writes, 5 million reads). The old note in the roadbook plan ("may need Workers Paid") is out of date.
- **Workflows have `step.waitForEvent`**, made for human-in-the-loop. A step can wait days, and the default
  timeout is 24 hours. On Workers Free each step gets 10 ms of CPU and 50 outside requests, which is plenty
  to orchestrate (start an agent, wait, start the next) but nowhere near enough to run an agent in.
- **Running the agents themselves on Workers** means rewriting what they assume: reading the thought from
  disk, writing files, pushing with git. It also moves the provider keys and the time limits. Nothing in
  this slice needs that.

## The idea

**A gate is a run that waits.** When an agent finishes, every gate that comes after it in the workflow opens
as its own run. That run stays open in state `needs-you`, carrying the question, until Victor closes it.
The studio already lists `needs-you` runs and shows their timelines. What is new is the control to answer,
and that closing a gate starts whatever comes after it. Git stays the record, Actions stays the place
agents run, and the studio only asks GitHub to act, the same way new origins already land.

## Decisions (open, with a recommendation each)

1. **Runtime for now: GitHub Actions** (recommended). Gates live in the ledger and in the studio. A
   Cloudflare Workflow per thought (orchestration only, agents still on Actions) is Slice 8d, decided after
   living with 8a–8c. Moving agents into Durable Objects is not planned.
2. **The answer to `answers` lands as an origin file** (recommended): `origin/answers.md`, the file the
   structure agent already reads. A later answer is a new file (`origin/answers-<stamp>.md`), never an
   edit, because origin is append-only. **Approving `message`** records `gate.closed` with
   `decision: approved`. "Not this" records `redirected` with Victor's words as `feedback.given`, which
   starts structure again with them.
3. **The run goes on by itself** (recommended): closing a gate starts the agents that come directly after
   it (`structure` after `answers`; `convert` and `image` after `message`), on the thought's branch, within
   the cards' budgets. The alternative is a "Run next" button for each step.
4. **`merge` stays a GitHub merge.** The studio links to the pull request and never merges (non-negotiable
   3). WebSockets wait for 8d: polling every 3 to 5 seconds is enough for one person.

## The slices

One slice per pull request, in this order. A slice is not done until CI is green and Victor merges it.

### Slice 8a: gates open in the ledger (runner only)

- After an agent run ends `done`, the runner looks up `blog-post` in `roadbook.config.ts`. Each gate whose
  `after` lists that agent, and whose other `after` steps are also done on this thought, opens as a run:
  - its id is `<stamp>-<gate id>-<hex>`;
  - its events are `run.started`, then `node.state` from `idle` to `needs-you`, then `gate.opened` with the
    gate's `asks` and `question`.
    It is saved beside the agent's ledger and committed in the same commit.
- A gate that is already open on the thought is not opened twice.
- Live reporting is unchanged: the gate run reaches the studio like any run, so the board's "Needs you",
  Today and the Agents tab show it with no studio change.
- **New rule RB080: a gate is closed only by a person.** A `gate.closed` or `override.given` whose `by` is
  an agent's name, or empty, fails verification with a plain message. It needs a fix and a test showing the
  ledger it refuses (core rules: no off switch).
- Done: running `interview` locally leaves an `answers` gate run in `needs-you`. It shows on Today within
  seconds. Running `interview` again does not open a second one. The ledger verifies.
- Good for: Opus or Fable (runner and core rule).

### Slice 8b: answer in the studio

- The run page and Today's row of an open gate show its control:
  - `answer`: a text box. Talk is also welcome: the recorder from Talk back, transcribed the same way.
  - `approve`: Approve, or Not this with words.
  - `pick`: one choice. No gate picks yet, so it can come later.
- `POST /api/gates/:run` checks that the run is an open gate on that thought and that the decision fits
  what it asks. It then sends `repository_dispatch` `close-gate` with the run, the thought, the decision,
  the words, and `by` (the Access email). Nothing else; the workflow writes.
- A new workflow, `gates.yml`, runs on the thought's branch:
  - it writes the answer file if there is one;
  - it resumes the gate run (`Ledger.resume`) and appends `feedback.given` (the words), `gate.closed`
    (decision, by), and `node.state` from `needs-you` to `done`;
  - it saves and commits, reporting live as it goes.
- While the dispatch is on its way, the studio says "Sent. Waiting for GitHub to record it", never
  "done".
- Done: answering the `answers` gate on the studio's run page turns that run Done on the board within about
  a minute. `origin/answers.md` is on the branch, and the ledger names Victor as the one who closed it. A
  second answer to a closed gate is refused with a plain message.
- Good for: Opus or Fable (an endpoint that causes writes, a workflow, a form that must be accessible).

### Slice 8c: the run goes on

- After `gate.closed`, `gates.yml` sends `repository_dispatch` `run-agent` for each agent directly after
  the gate. `agents.yml` gains that trigger and checks out the branch it is given. `redirected` on
  `message` starts structure again with the words.
- A "Run an agent" control on a thought in the studio (the pipeline row) sends the same `run-agent`, for
  re-runs and for steps no gate starts.
- Budget: a dispatch that would take the thought or the month past its cap is refused before it is sent,
  and the studio says so (the caps are in `roadbook.config.ts`).
- Done: approving the `message` gate starts `convert` and `image` within a minute; both show Running on the
  board and the pipeline, and open their own gates or holds when they end. One press re-runs an agent.
- Good for: Opus or Fable.

### Slice 8d: orchestration on Cloudflare (needs its own decision first)

- One Cloudflare Workflow per thought runs `blog-post`. Each agent step sends `run-agent` and waits
  (`waitForEvent`) for the run's last event, which the events endpoint passes on. Each gate step waits
  for Victor's answer. GitHub Actions still runs every agent.
- What it adds over 8c: the whole thought's progress in one place, timeouts and reminders (a gate open for
  three days says so), and a natural home for WebSockets if polling ever feels slow.
- Decide after living with 8a–8c. If the dispatch chain in 8c is reliable, 8d may never be needed.

## Later (each needs its own plan before work starts)

- Holds get the same control: "I have looked; publish anyway" as `override.given` with a reason
  (RB080 applies), or "run the guard again". A guard's hold reason can quote private things, so it stays in
  the studio and never reaches the post.
- Agents asking in the middle of a run (an agent stops itself with a question, not a gate between agents).
  This needs a run that can pause mid-node, which is 8d's territory.
- Agents running on Workers.

## Rules for any agent picking up a slice

- Branch from `main`, named `feat/questions-<slice>` (for example `feat/questions-8a`). One slice per pull
  request, using the template. Before starting, check that no other session has the slice:
  `gh pr list --state all`, the remote branches, and `git worktree list`.
- Never edit anything under `thoughts/*/origin/`; an answer is a new origin file.
- The studio only asks; a workflow writes; git is the record; D1 is the live copy, rebuildable from git.
- Accessibility is the floor: every control reachable and named, status changes announced once.
