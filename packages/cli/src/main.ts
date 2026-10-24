// Why: the roadbook command is how a person (or CI, or Claude through the MCP server) asks two questions
// about a project before anything is built: "is this allowed?" (validate) and "what will it do?" (plan).
// It reads roadbook.config.ts, counts each agent's test cases on disk, and answers in plain words.
//
//   roadbook validate [--config path] [--json]
//   roadbook plan     [--config path] [--json]
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { plan, validate, type Issue, type Plan, type Validation } from '@roadbook/core';

interface Args {
  command: 'validate' | 'plan' | 'help';
  config: string;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const [first, ...rest] = argv;
  const command = first === 'validate' || first === 'plan' ? first : 'help';
  let config = 'roadbook.config.ts';
  let json = false;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--json') json = true;
    if (arg === '--config') config = rest[i + 1] ?? config;
  }
  return { command, config: resolve(config), json };
}

async function loadConfig(path: string): Promise<unknown> {
  const mod = (await import(pathToFileURL(path).href)) as { default?: unknown };
  if (mod.default === undefined) {
    throw new Error(`${path} has no default export; it should end with "export default defineProject({ … })".`);
  }
  return mod.default;
}

/** Counts *.json cases in agents/<name>/tests/ next to the config, for every card the project names. */
async function countTests(configPath: string, input: unknown): Promise<Record<string, number>> {
  const names = new Set<string>();
  const workflows = (input as { workflows?: { nodes?: Record<string, { card?: { name?: unknown } }> }[] })
    .workflows;
  for (const wf of workflows ?? []) {
    for (const node of Object.values(wf.nodes ?? {})) {
      if (typeof node.card?.name === 'string') names.add(node.card.name);
    }
  }
  const counts: Record<string, number> = {};
  for (const name of names) {
    try {
      const files = await readdir(join(dirname(configPath), 'agents', name, 'tests'));
      counts[name] = files.filter((f) => f.endsWith('.json')).length;
    } catch {
      counts[name] = 0;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------------------------- output

const bold = (s: string): string => (process.stdout.isTTY ? `\u001b[1m${s}\u001b[22m` : s);

function printIssues(issues: Issue[]): void {
  for (const i of issues) {
    const mark = i.severity === 'error' ? 'refused' : 'warning';
    console.info(`  ${bold(`${mark} ${i.rule}`)}  ${i.where}`);
    console.info(`    ${i.message}`);
    console.info(`    fix: ${i.fix}`);
  }
}

function printValidation(v: Validation): void {
  const errors = v.issues.filter((i) => i.severity === 'error').length;
  const warnings = v.issues.length - errors;
  if (v.issues.length > 0) printIssues(v.issues);
  console.info(
    v.ok
      ? `\n${bold('valid')}: every accountability rule holds${warnings > 0 ? ` (${String(warnings)} warning${warnings === 1 ? '' : 's'})` : ''}.`
      : `\n${bold('not valid')}: ${String(errors)} rule${errors === 1 ? '' : 's'} broken. Nothing will be built until they are fixed.`,
  );
}

const usd = (n: number): string => `$${n.toFixed(n < 1 ? 3 : 2)}`;

function printPlan(p: Plan): void {
  console.info(`${bold(p.project)}, owned by ${p.owner}\n`);
  for (const wf of p.workflows) {
    console.info(`${bold(`Workflow ${wf.id}`)}: ${wf.why}`);
    for (const n of wf.nodes) {
      const extra = [n.provider && `on ${n.provider}`, n.maxUsdPerRun !== undefined && `≤ ${usd(n.maxUsdPerRun)}`]
        .filter(Boolean)
        .join(', ');
      console.info(`  ${n.kind.padEnd(6)} ${n.id}${extra ? `  (${extra})` : ''}`);
    }
    for (const g of wf.gates) {
      console.info(`  a person ${g.asks}s at "${g.id}": ${g.question}${g.capacity ? ` [capacity ${g.capacity}]` : ''}`);
    }
    for (const s of wf.sinks) console.info(`  leaves by "${s.id}": ${s.target}`);
    console.info(`  at most ${usd(wf.maxUsdPerRun)} a run if every agent runs once\n`);
  }
  console.info(bold('Where data goes'));
  for (const e of p.exits) {
    console.info(
      `  ${e.provider} (${e.kind}): ${e.sends.join(', ')} → ${e.region}, retention ${e.retention}; used by ${e.usedBy.join(', ') || 'nothing yet'}`,
    );
  }
  console.info(`\n${bold('What will be created in the owner’s account')}`);
  for (const r of p.resources) console.info(`  ${r.kind}: ${r.name}. ${r.why}`);
  console.info(`\n${bold('Secrets')}`);
  for (const s of p.secrets) {
    console.info(`  ${s.setHere ? 'set    ' : 'not set'} ${s.name} (for ${s.neededBy.join(', ')})`);
  }
  console.info(`\n${bold('Budget')}: ${usd(p.budget.monthlyCapUsd)} a month; at cap, work queues.`);
  if (p.budget.runsAtCap !== null) {
    console.info(`  That is at least ${String(p.budget.runsAtCap)} full runs of the costliest workflow.`);
  }
  if (p.capacity.length > 0) {
    console.info(`\n${bold('Capacity')}`);
    for (const c of p.capacity) console.info(`  ${c.gate}: ${c.limit}`);
  }
}

const help = `roadbook: the record of every turn an agent took, who decided it, and why.

  roadbook validate   check roadbook.config.ts against every accountability rule
  roadbook plan       show what the project will do, cost, send and create

  --config <path>     a different setup file (default: ./roadbook.config.ts)
  --json              machine-readable output`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'help') {
    console.info(help);
    return;
  }

  const input = await loadConfig(args.config);
  const result = validate(input, { testCounts: await countTests(args.config, input) });

  if (args.command === 'validate') {
    if (args.json) console.info(JSON.stringify(result, null, 2));
    else printValidation(result);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (!result.project) {
    printValidation(result);
    process.exitCode = 1;
    return;
  }
  const planned = plan(result.project, process.env);
  if (args.json) {
    console.info(JSON.stringify({ plan: planned, issues: result.issues }, null, 2));
  } else {
    printPlan(planned);
    console.info('');
    printValidation(result);
  }
  if (!result.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
