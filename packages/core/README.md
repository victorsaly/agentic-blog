# @roadbook/core

Agentic Roadbook is a framework for agent workflows a person can see, steer and answer for. A rally roadbook
records every turn of the route; this one records every turn an agent took, who decided it, and why.

This package is the part that knows nothing about any one project: the shape of a project, the rules it
must meet, the plan of what it will do, and the ledger every run writes to. The blog in this repository is
its first project; `roadbook.config.ts` at the root describes it.

## The accountability rules, and where each one lives

These are not options a project may switch on. Each is enforced in code, and the tests in `src/` are the
rules written as examples.

| Rule | Enforced by |
| --- | --- |
| Every output has a receipt: origin, inputs hash, agent, card version, prompt hash, model, provider, time, cost | `Receipt` on every `node.output` event (`ledger.ts`) |
| Every output says why | the ledger refuses a `node.output` without one; the schema requires a why on every node, card and exit |
| A person approves before anything leaves | `RB010`: every path into a sink must pass a gate that asks *approve* |
| Nothing is rewritten | the ledger is append-only and hash-chained; `Ledger.verify` finds any edit or removal; a mistake is fixed with a `correction` event |
| The disclosure is computed, not typed | `disclosure()` reads the ledger; an output counts as edited by a person only if an edit was recorded |
| Overruling is allowed, never silent | the ledger refuses an `override.given` without a reason; the schema has no way to say otherwise |
| Failures show | `node.state` records *failed* and *held* like any other state; replay shows them |
| Data rules are declared | `RB041`–`RB044`: every provider has a declared exit, in an allowed region, sending only the kinds of data the agent's card says; the project is hosted in the owner's account, and there is no other option |

## The agent card

Every agent and guard carries a card (`AgentCard` in `schema.ts`): purpose, why, inputs, outputs, must-nots,
done-means checks, a quality bar, allowed models, a budget, whether a gate follows it, the data it sends, an
owner, a version and a stage. Only *active* agents may reach a sink (`RB031`). An agent with no test set is
a warning (`RB060`) until a project decides to make it an error.

## Use

```ts
import { validate, plan } from '@roadbook/core';

const result = validate(config);
if (result.ok && result.project) console.log(plan(result.project, process.env));
```

Or from the repository root: `npm run roadbook -- validate` and `npm run roadbook -- plan`.

## What is not here yet

The live runtime (one Cloudflare Agent per run), the studio components, the provider adapters, `build`,
`deploy`, the builder and the MCP server come in later slices. See the plan: *Agentic Roadbook: framework plan*.
