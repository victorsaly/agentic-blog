// Why: the runner records every run in the thought's ledger. What each event says is decided here, in small
// pure functions, so the rules can be tested without a model or a disk: which state a run starts from and
// ends in, which why an output carries, which origin a run started from, and that an agent never writes the
// ledger itself.
import matter from 'gray-matter';
import type { EventBody, LedgerEvent, NodeState } from '@roadbook/core';
import { isLedgerPath } from '@roadbook/core/node';
import type { AgentResult, OutputFile } from './types.js';

/** Where an agent stands in this thought's ledger before a new run: its last recorded state, or idle. */
export function lastState(events: readonly LedgerEvent[], node: string): NodeState {
  let state: NodeState = 'idle';
  for (const e of events) if (e.type === 'node.state' && e.node === node) state = e.to;
  return state;
}

/**
 * The state changes that open a run. A run before this one that never recorded how it ended (killed by a
 * timeout, say) is closed as failed first, with that said, so two runs never look as if they overlap.
 */
export function startStates(node: string, last: NodeState): EventBody[] {
  if (last !== 'running') return [{ type: 'node.state', node, from: last, to: 'running' }];
  return [
    {
      type: 'node.state',
      node,
      from: 'running',
      to: 'failed',
      reason: 'the run before this one ended without recording how',
    },
    { type: 'node.state', node, from: 'failed', to: 'running' },
  ];
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

/**
 * Where the run started, as a path in the repo: the recording when the origin folder holds one, else its
 * first written origin (a transcript or a text). Answers to the interview, at any depth, are never the origin.
 * Pass every file under the thought, not only its Markdown, so a recording can be found.
 */
export function originOf(slug: string, files: Iterable<string>): string {
  const origins = [...files]
    .map((path) => path.replace(/\\/g, '/'))
    .filter((path) => path.startsWith('origin/') && path.split('/').at(-1) !== 'answers.md')
    .sort((a, b) => Number(a.endsWith('.md')) - Number(b.endsWith('.md')) || a.localeCompare(b));
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
    if (isLedgerPath(file.path))
      throw new Error(`refusing to write ${file.path}: only the runner writes the ledger`);
  }
}
