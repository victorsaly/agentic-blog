// Why: one command runs any agent on any thought, locally or in GitHub Actions, the same way:
//   npm run agent -- <agent> <thought-slug>
// It loads the context, runs the agent, writes what it returns (never under origin/), and prints a
// summary the workflow turns into a pull request body. A held result exits non-zero on purpose.
// Every run is recorded in the thought's ledger (thoughts/<slug>/ledger.jsonl and ledger.head): that it
// started, the state it moved through, what it cost as the model reported it, and each file it wrote with a
// receipt. A run that fails is recorded as failed before the error goes on.
import { resolve } from 'node:path';
import { hashOf, type AgentCardInput } from '@roadbook/core';
import { createAskClient } from './_lib/claude.js';
import { hasPrice, unitsOf, usdFor } from './_lib/costs.js';
import { openLedger, saveLedger } from './_lib/ledger-file.js';
import { assertNotLedger, endState, lastState, originOf, startedBy, whyOf } from './_lib/record.js';
import {
  loadProfile,
  loadPrompt,
  loadSettings,
  loadThought,
  systemMessage,
} from './_lib/context.js';
import { writeOutputs } from './_lib/files.js';
import { agentNames, type AgentContext, type AgentName, type AgentRun } from './_lib/types.js';

function isAgentName(value: string): value is AgentName {
  return (agentNames as readonly string[]).includes(value);
}

async function main(): Promise<void> {
  const [agent, slug] = process.argv.slice(2);
  if (!agent || !isAgentName(agent) || !slug) {
    console.error(`usage: npm run agent -- <${agentNames.join('|')}> <thought-slug>`);
    process.exitCode = 2;
    return;
  }

  const root = resolve(import.meta.dirname, '..');
  const [settings, profile, prompt, thought] = await Promise.all([
    loadSettings(root),
    loadProfile(root),
    loadPrompt(root, agent),
    loadThought(root, slug),
  ]);

  const model = prompt.meta.model ?? settings.agents.model;
  if (!hasPrice(model))
    throw new Error(
      `no price for ${model}; add it to agents/_lib/costs.ts before running ${agent}`,
    );
  const { card } = (await import(`./${agent}/card.js`)) as { card: AgentCardInput };

  const system = systemMessage(profile, prompt, settings);
  const client = createAskClient(system, {
    model,
    maxOutputTokens: prompt.meta.max_output_tokens ?? settings.agents.max_output_tokens,
  });

  const ctx: AgentContext = {
    agent,
    prompt,
    settings,
    profile,
    thought,
    ask: client.ask,
    today: new Date().toISOString().slice(0, 10),
  };

  // A ledger that does not verify stops the run here, before anything is spent or written.
  const open = await openLedger(thought.dir);
  const { ledger } = open;
  const node = agent;
  const origin = originOf(slug, thought.files.keys());
  const from = lastState(ledger.events, node);
  await ledger.append({
    type: 'run.started',
    workflow: 'blog-post',
    origin,
    by: startedBy(process.env),
  });
  await ledger.append({ type: 'node.state', node, from, to: 'running' });

  // One cost event per model, from the usage the model reported; returns the run's total.
  const recordCosts = async (): Promise<number> => {
    let total = 0;
    for (const [used, usage] of client.usage()) {
      const usd = usdFor(used, usage);
      total += usd;
      await ledger.append({
        type: 'cost.incurred',
        node,
        provider: card.model.default,
        usd,
        units: unitsOf(used, usage),
      });
    }
    return Math.round(total * 1_000_000) / 1_000_000;
  };

  const fallback = agent === 'profile' || agent === 'drilldown' ? 'repo' : 'thought';
  let result: Awaited<ReturnType<AgentRun>>;
  let written: string[];
  try {
    const module = (await import(`./${agent}/index.js`)) as { run: AgentRun };
    result = await module.run(ctx);
    assertNotLedger(result.files);
    written = await writeOutputs({ thought: thought.dir, repo: root, fallback }, result.files);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    await recordCosts();
    await ledger.append({
      type: 'node.state',
      node,
      from: 'running',
      to: 'failed',
      reason: reason.slice(0, 300),
    });
    await saveLedger(thought.dir, open);
    throw error;
  }

  const usd = await recordCosts();
  const receipt = {
    origin,
    inputsHash: await hashOf({
      files: Object.fromEntries([...thought.files].sort(([a], [b]) => a.localeCompare(b))),
      profile,
      settings,
    }),
    agent,
    cardVersion: card.version,
    promptHash: await hashOf(system),
    provider: card.model.default,
    model,
    at: new Date().toISOString(),
    // What the whole run cost; every file it wrote carries the same figure.
    usd,
  };
  for (const file of result.files) {
    if (file.remove === true) continue;
    const base = file.base ?? fallback;
    await ledger.append({
      type: 'node.output',
      node,
      why: whyOf(file, result.summary, prompt.meta.why),
      receipt,
      ref: base === 'thought' ? `thoughts/${slug}/${file.path}` : file.path,
      authoredBy: 'agent',
    });
  }
  const end = endState(result);
  await ledger.append({
    type: 'node.state',
    node,
    from: 'running',
    to: end.to,
    ...(end.reason ? { reason: end.reason } : {}),
  });
  await saveLedger(thought.dir, open);

  console.info(
    JSON.stringify({
      agent,
      slug,
      status: result.status,
      summary: result.summary,
      written,
      holdReason: result.holdReason ?? null,
      usd,
    }),
  );
  if (result.status === 'held') process.exitCode = 3;
  if (result.status === 'not-implemented') process.exitCode = 4;
}

await main();
