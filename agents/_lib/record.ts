// Why: the runner records every run in the thought's ledger. What each event says is decided here, in small
// pure functions, so the rules can be tested without a model or a disk: which state a result ends in, which
// why an output carries, which origin a run started from, and that an agent never writes the ledger itself.
import matter from 'gray-matter';
import type { LedgerEvent, NodeState } from '@roadbook/core';
import { HEAD_FILE, LEDGER_FILE } from './ledger-file.js';
import type { AgentResult, OutputFile } from './types.js';

/** Where an agent stands in this thought's ledger before a new run: its last recorded state, or idle. */
export function lastState(events: readonly LedgerEvent[], node: string): NodeState {
  let state: NodeState = 'idle';
  for (const e of events) if (e.type === 'node.state' && e.node === node) state = e.to;
  return state;
}

/** The state a run ends in, and why, from what the agent returned. */
export function endState(result: AgentResult): { to: NodeState; reason?: string } {
  switch (result.status) {
    case 'done':
      return { to: 'done' };
    case 'nothing-to-do':
      return { to: 'done', reason: 'nothing to do' };
    case 'held':
      return { to: 'held', reason: result.holdReason ?? 'held without a reason' };
    case 'not-implemented':
      return { to: 'idle', reason: 'not implemented yet' };
  }
}

const MIN_WHY = 20;

/**
 * The why an output is recorded with: the file's own why when it is Markdown with one, else the agent's
 * summary of the run, else the agent's own why. A picture has no front matter, so it takes the summary.
 */
export function whyOf(file: OutputFile, summary: string, agentWhy: string): string {
  if (file.bytes === undefined && file.path.endsWith('.md')) {
    const why: unknown = matter(file.content).data['why'];
    if (typeof why === 'string' && why.trim().length >= MIN_WHY)
      return why.trim().replace(/\s+/g, ' ');
  }
  const tidy = summary.trim().replace(/\s+/g, ' ');
  return tidy.length >= MIN_WHY ? tidy : agentWhy.trim().replace(/\s+/g, ' ');
}

/** Where the run started: the thought's first origin file, as a path in the repo. */
export function originOf(slug: string, files: Iterable<string>): string {
  const origins = [...files]
    .filter((path) => path.startsWith('origin/') && path !== 'origin/answers.md')
    .sort();
  return `thoughts/${slug}/${origins[0] ?? 'origin/'}`;
}

/** Who started the run: the GitHub account in a workflow, otherwise someone running it on their machine. */
export function startedBy(env: NodeJS.ProcessEnv): string {
  const actor = env['GITHUB_ACTOR'];
  return actor ? `github:${actor}` : 'local';
}

/** The runner keeps the ledger; an agent that tries to write or remove it is refused. */
export function assertNotLedger(files: readonly OutputFile[]): void {
  for (const file of files) {
    const name = file.path.split('/').at(-1);
    if (name === LEDGER_FILE || name === HEAD_FILE)
      throw new Error(`refusing to write ${file.path}: only the runner writes the ledger`);
  }
}
