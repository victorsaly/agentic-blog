// Why: one command runs any agent on any thought, locally or in GitHub Actions, the same way:
//   npm run agent -- <agent> <thought-slug>
// It loads the context, runs the agent, writes what it returns (never under origin/), and prints a
// summary the workflow turns into a pull request body. A held result exits non-zero on purpose.
// Every run is recorded in its own file in the thought's ledger (thoughts/<slug>/ledger/<run>.jsonl, with its
// head in <run>.head): that it started, the state it moved through, what it cost as each provider reported
// it, and each file it wrote with a receipt. With STUDIO_URL set, each event is also sent to the studio as it
// is recorded, so the run shows there while it happens (see _lib/live.ts). A run that fails at any point after it starts is recorded as
// failed, and saved, before the error goes on.
// Agents never call a provider themselves: ask() and draw() go to the providers the agent's card allows,
// declared once in roadbook.config.ts, and every call's usage is logged and priced the same way.
import { resolve } from 'node:path';
import {
  Ledger,
  LedgerError,
  UsageLog,
  costOf,
  describeUsage,
  hashOf,
  type AgentCardInput,
} from '@roadbook/core';
import { readRuns, runId, saveRun } from '@roadbook/core/node';
import { adapterFor, choose, connect, textModel, unpriced } from './_lib/models.js';
import { prices, shares } from './_lib/prices.js';
import {
  assertNotLedger,
  endState,
  lastState,
  originOf,
  startStates,
  startedBy,
  whyOf,
} from './_lib/record.js';
import {
  originFiles,
  loadProfile,
  loadPrompt,
  loadSettings,
  loadThought,
  systemMessage,
} from './_lib/context.js';
import { writeOutputs } from './_lib/files.js';
import { liveFromEnv } from './_lib/live.js';
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

  const { card } = (await import(`./${agent}/card.js`)) as { card: AgentCardInput };
  const project = await import('../roadbook.config.js');
  const adapters = new Map(
    Object.entries(project.default.providers).map(([name, p]) => [name, adapterFor(name, p)]),
  );
  const chosen = choose(card, adapters);
  const model = textModel(chosen, prompt.meta.model, settings.agents.model);
  // Every model this run may bill for has a price, or nothing is spent.
  const missing = unpriced(chosen, model);
  if (missing.length > 0)
    throw new Error(
      `no price for ${missing.join(', ')}; add it to agents/_lib/prices.ts before running ${agent}`,
    );

  const system = systemMessage(profile, prompt, settings);
  const log = new UsageLog();
  const calls = connect(chosen, log, {
    system,
    model,
    maxOutputTokens: prompt.meta.max_output_tokens ?? settings.agents.max_output_tokens,
  });

  const ctx: AgentContext = {
    agent,
    prompt,
    settings,
    profile,
    thought,
    ask: calls.ask,
    draw: calls.draw,
    speak: calls.speak,
    today: new Date().toISOString().slice(0, 10),
  };

  // A past run that does not verify stops this one here, before anything is spent or written.
  const past = await readRuns(thought.dir, `thoughts/${slug}`);
  if (past.issues.length > 0) throw new LedgerError(`refused: ${past.issues.join(' ')}`);
  const node = agent;
  const origin = originOf(slug, await originFiles(thought.dir));
  const run = runId(new Date(), agent);
  // Each event also goes to the studio as it is recorded, when STUDIO_URL is set; the file stays the record.
  const live = liveFromEnv(run, slug, process.env);
  const ledger = new Ledger({ onAppend: live.hear });

  // One cost event per provider and model, from the usage each reported; returns the run's total.
  // Recorded once.
  let costed: number | null = null;
  const recordCosts = async (): Promise<number> => {
    if (costed !== null) return costed;
    let total = 0;
    for (const used of log.totals()) {
      const usd = costOf(prices, used.model, used.usage);
      total += usd;
      await ledger.append({
        type: 'cost.incurred',
        node,
        provider: used.provider,
        usd,
        units: describeUsage(used.model, used.usage),
      });
    }
    costed = Math.round(total * 1_000_000) / 1_000_000;
    return costed;
  };

  const fallback = agent === 'profile' || agent === 'drilldown' ? 'repo' : 'thought';
  let result: Awaited<ReturnType<AgentRun>>;
  let written: string[];
  let usd: number;
  let ended = false;
  try {
    await ledger.append({
      type: 'run.started',
      workflow: 'blog-post',
      origin,
      by: startedBy(process.env),
    });
    for (const body of startStates(
      node,
      lastState(
        past.runs.flatMap((r) => r.events),
        node,
      ),
    ))
      await ledger.append(body);

    const module = (await import(`./${agent}/index.js`)) as { run: AgentRun };
    result = await module.run(ctx);
    assertNotLedger(result.files);
    written = await writeOutputs({ thought: thought.dir, repo: root, fallback }, result.files);

    usd = await recordCosts();
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
      provider: chosen.writer.provider,
      model,
      at: new Date().toISOString(),
    };
    // A picture or a recording names the provider that made it; the text the writer wrote names the writer.
    const makers = new Set([...chosen.drawers, ...(chosen.speakers ?? [])].map((d) => d.provider));
    const drew = log.totals().find((t) => makers.has(t.provider));
    // The run's cost is shared across the files it wrote, so adding up receipts gives the run's cost once.
    const kept = result.files.filter((file) => file.remove !== true);
    const split = shares(usd, kept.length);
    for (const [index, file] of kept.entries()) {
      const base = file.base ?? fallback;
      await ledger.append({
        type: 'node.output',
        node,
        why: whyOf(file, result.summary, prompt.meta.why),
        receipt: {
          ...(file.bytes !== undefined && drew
            ? { ...receipt, provider: drew.provider, model: drew.model }
            : receipt),
          usd: split[index] ?? 0,
        },
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
    ended = true;
  } catch (error: unknown) {
    // Whatever went wrong after the run started, the run is recorded as failed, with what it cost.
    if (!ended) {
      const reason = error instanceof Error ? error.message : String(error);
      await recordCosts();
      await ledger.append({
        type: 'node.state',
        node,
        from: 'running',
        to: 'failed',
        reason: reason.slice(0, 300),
      });
    }
    throw error;
  } finally {
    await saveRun(thought.dir, run, ledger);
    await live.flush();
  }

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
