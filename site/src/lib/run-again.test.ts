// Why: Run again spends money on Victor's press; it must refuse what is not an agent and what would pass the
// month's cap, before anything is sent.
import { describe, expect, it } from 'vitest';
import type { WorkflowInput } from '@roadbook/core';
import { againAllowed, allowanceOf, readAgainRequest } from './run-again';

const workflow = {
  id: 'w',
  why: 'An agent, a guard and a gate.',
  nodes: {
    citations: { kind: 'agent', why: 'Finds sources.', card: { budget: { usdPerRun: 0.15 } } },
    safety: { kind: 'guard', why: 'Checks.', card: { budget: { usdPerRun: 0.05 } } },
    merge: { kind: 'gate', why: 'Owner.', asks: 'approve', question: 'Live?' },
  },
} as unknown as WorkflowInput;

describe('run again', () => {
  it('knows what an agent or a guard may cost, and nothing else', () => {
    expect(allowanceOf(workflow, 'citations')).toBe(0.15);
    expect(allowanceOf(workflow, 'safety')).toBe(0.05);
    expect(allowanceOf(workflow, 'merge')).toBeNull();
    expect(allowanceOf(workflow, 'nobody')).toBeNull();
  });

  it('starts only what fits under the month’s cap, and says why not', () => {
    expect(againAllowed(workflow, 'citations', 10, 30)).toEqual({ ok: true, allowance: 0.15 });
    const over = againAllowed(workflow, 'citations', 29.9, 30);
    expect(over.ok).toBe(false);
    expect(over.ok ? '' : over.error).toMatch(/spent \$29\.90 of \$30\.00/);
    expect(againAllowed(workflow, 'merge', 0, 30).ok).toBe(false);
  });

  it('reads only an agent’s name and a thought’s folder', () => {
    expect(readAgainRequest({ agent: 'voice', thought: '2026-10-25-a-thought' })).toEqual({
      ok: true,
      value: { agent: 'voice', thought: '2026-10-25-a-thought' },
    });
    expect(readAgainRequest({ agent: 'voice; rm', thought: '2026-10-25-a' }).ok).toBe(false);
    expect(readAgainRequest({ agent: 'voice', thought: '../x' }).ok).toBe(false);
    expect(readAgainRequest(null).ok).toBe(false);
  });
});
