# @roadbook/core

Agentic Roadbook is a framework for agent workflows a person can see, steer and answer for. A rally roadbook
records every turn of the route; this one records every turn an agent took, who decided it, and why.

This package is the part that knows nothing about any one project: the shape of a project, the rules it
must meet, the plan of what it will do, and the ledger every run writes to. The blog in this repository is
its first project; `roadbook.config.ts` at the root describes it.

## The accountability rules, and where each one lives

These are not options a project may switch on. Each is enforced in code, and the tests in `src/` are the
rules written as examples.

| Rule                                                                                                           | Enforced by                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every output has a receipt: origin, inputs hash, agent, card version, prompt hash, model, provider, time, cost | `Receipt` on every `node.output` event (`ledger.ts`)                                                                                                                                                                                                                                       |
| Every output says why                                                                                          | the ledger refuses a `node.output` without one; the schema requires a why on every node, card and exit                                                                                                                                                                                     |
| A person approves before anything leaves                                                                       | `RB010`: every path into a sink must pass a gate that asks _approve_                                                                                                                                                                                                                       |
| Nothing is rewritten                                                                                           | the ledger is append-only and hash-chained; `Ledger.verify` finds any edit or removal in the chain, and a cut end when given the head kept from the run; each run is its own file (`node/ledger-files.ts`), so branches never fork one chain; a mistake is fixed with a `correction` event |
| The disclosure is computed, not typed                                                                          | `disclosure()` reads the ledger; an output counts as edited by a person only if an edit was recorded                                                                                                                                                                                       |
| Overruling is allowed, never silent                                                                            | the ledger refuses an `override.given` without a reason; the schema has no way to say otherwise                                                                                                                                                                                            |
| A person decides at a gate                                                                                     | `RB080`: the ledger refuses a `gate.closed` or `override.given` whose `by` is not a person (the owner, or an email); `refuse()` runs on writing and again on reading, so a hand-made event with a good hash is refused too (`ledger.ts`, `gates.ts` says when a gate opens)                |
| Failures show                                                                                                  | `node.state` records _failed_ and _held_ like any other state; replay shows them                                                                                                                                                                                                           |
| Data rules are declared                                                                                        | `RB041`–`RB044`: every provider has a declared exit, in an allowed region, sending only the kinds of data the agent's card says; the project is hosted in the owner's account, and there is no other option                                                                                |

## The agent card

Every agent and guard carries a card (`AgentCard` in `schema.ts`). The framework will not run an agent whose
card is incomplete.

| Field                 | What it answers                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| purpose, why          | the one job, and why the agent exists                                                                                                                                                                                   |
| inputs, outputs       | what it reads and produces, with types and limits                                                                                                                                                                       |
| mustNot               | the lines it never crosses                                                                                                                                                                                              |
| doneMeans             | the checks every output must pass                                                                                                                                                                                       |
| qualityBar, metrics   | the numbers it is scored on and the target for each (approvals as written, checks passed, cost)                                                                                                                         |
| model                 | the default provider and the ones it is allowed to use                                                                                                                                                                  |
| budget                | cost and time per run                                                                                                                                                                                                   |
| behaviour             | does a person approve its output; how many retries, on what, with feedback or not; what happens when retries run out (stop the run, skip the node, or try the fallback once); who is told, when, and what they are told |
| variables             | settings a workflow may tune per node (`vars`), each with a type, a default and a why                                                                                                                                   |
| data                  | the kinds of data it sends out                                                                                                                                                                                          |
| owner, version, stage | who answers for it, which version runs, and whether it is draft, trial, active or retired                                                                                                                               |

The rules that keep this honest:

| Rule  | What it refuses                                                             |
| ----- | --------------------------------------------------------------------------- |
| RB031 | a draft or trial agent on a path to a sink                                  |
| RB032 | an agent whose card needs approval with no gate after it                    |
| RB033 | a fallback that is missing, not allowed, or the same model that just failed |
| RB034 | a guard that would be skipped when it fails, letting unchecked work through |
| RB035 | escalation to a gate that does not exist                                    |
| RB036 | a node setting a variable its card does not declare, or with the wrong type |
| RB060 | (warning) an agent with no test set                                         |

`plan` counts retries and fallbacks in the worst-case cost of every run, so a generous retry policy shows up
in the budget before it shows up on the bill.

## Use

```ts
import { validate, plan } from '@roadbook/core';

const result = validate(config);
if (result.ok && result.project) console.log(plan(result.project, process.env));
```

Or from the repository root: `npm run roadbook -- validate` and `npm run roadbook -- plan`.

## What is not here yet

The live runtime (one Cloudflare Agent per run), the studio components, the provider adapters, `build`,
`deploy`, the builder and the MCP server come in later slices. See the plan: _Agentic Roadbook: framework plan_.
