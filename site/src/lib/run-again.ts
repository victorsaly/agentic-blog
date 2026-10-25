// Why: when an agent does not finish, or a guard holds, Victor runs it again from the studio instead of asking
// for it by hand. Before anything is sent this checks what it may cost: the step must be an agent or a guard
// of the workflow, and its allowance per run, on top of what the month has spent, must fit under the cap (the
// same check the runner makes before spending). Pure, so it is tested; the Worker reads the month's spend.
import type { WorkflowInput } from '@roadbook/core';

const SLUG = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const NAME = /^[a-z][a-z-]*$/;

export interface AgainRequest {
  agent: string;
  thought: string;
}

export function readAgainRequest(
  body: unknown,
): { ok: true; value: AgainRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null)
    return { ok: false, error: 'Say which agent and which thought.' };
  const { agent, thought } = body as Record<string, unknown>;
  if (typeof agent !== 'string' || !NAME.test(agent))
    return { ok: false, error: 'That is not an agent’s name.' };
  if (typeof thought !== 'string' || !SLUG.test(thought))
    return { ok: false, error: 'That is not a thought’s folder name.' };
  return { ok: true, value: { agent, thought } };
}

/** What one run of the step may cost, by its card; null when the workflow has no such agent or guard. */
export function allowanceOf(workflow: WorkflowInput, agent: string): number | null {
  const node = workflow.nodes[agent];
  if (node?.kind !== 'agent' && node?.kind !== 'guard') return null;
  const usd = (node as { card?: { budget?: { usdPerRun?: unknown } } }).card?.budget?.usdPerRun;
  return typeof usd === 'number' ? usd : null;
}

/** Whether running the step again fits under the month's cap, and what it may cost. */
export function againAllowed(
  workflow: WorkflowInput,
  agent: string,
  spentUsd: number,
  capUsd: number,
): { ok: true; allowance: number } | { ok: false; error: string } {
  const allowance = allowanceOf(workflow, agent);
  if (allowance === null) return { ok: false, error: `${agent} is not an agent of this workflow.` };
  if (spentUsd + allowance > capUsd)
    return {
      ok: false,
      error: `Not started: this month has spent $${spentUsd.toFixed(2)} of $${capUsd.toFixed(2)}, and ${agent} may cost up to $${allowance.toFixed(2)}.`,
    };
  return { ok: true, allowance };
}
