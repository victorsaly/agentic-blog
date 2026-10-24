// Why: plan is what the owner reads before anything is built; if it gets the cost, the exits or the
// missing secrets wrong, the owner decides on wrong information.
import { describe, expect, it } from 'vitest';
import { plan } from './plan.js';
import { project as projectSchema } from './schema.js';
import { project } from './fixture.test-helper.js';

const parsed = projectSchema.parse(project());

describe('plan', () => {
  it('lists the nodes, the gate with its capacity, and the sink', () => {
    const p = plan(parsed);
    const [wf] = p.workflows;
    expect(wf?.nodes.map((n) => n.id)).toEqual(['origin', 'write', 'approve', 'publish']);
    expect(wf?.gates).toEqual([
      { id: 'approve', asks: 'approve', question: 'Publish this draft?', capacity: '2 a day' },
    ]);
    expect(wf?.sinks).toEqual([{ id: 'publish', target: 'GitHub pull request on owner/repo' }]);
  });

  it('puts an upper bound on cost and on runs within the monthly cap', () => {
    const p = plan(parsed);
    expect(p.workflows[0]?.maxUsdPerRun).toBeCloseTo(0.1); // one try plus one retry
    expect(p.budget).toEqual({ monthlyCapUsd: 10, runsAtCap: 100 });
  });

  it('shows every data exit and who uses it', () => {
    expect(plan(parsed).exits).toEqual([
      {
        provider: 'writer',
        kind: 'claude',
        sends: ['text'],
        region: 'eu',
        retention: 'zero',
        usedBy: ['post/write'],
      },
    ]);
  });

  it('says which secrets are needed and which are set in this shell', () => {
    const missing = plan(parsed, {});
    expect(missing.secrets).toEqual([
      { name: 'ANTHROPIC_API_KEY', neededBy: ['writer'], setHere: false },
      { name: 'GITHUB_TOKEN', neededBy: ['sink owner/repo'], setHere: false },
    ]);
    const set = plan(parsed, { ANTHROPIC_API_KEY: 'x' });
    expect(set.secrets[0]?.setHere).toBe(true);
  });

  it('lists what the runtime will create in the owner’s account', () => {
    expect(plan(parsed).resources.map((r) => r.kind)).toEqual([
      'cloudflare-worker',
      'custom-domain',
      'access-application',
      'r2-bucket',
    ]);
  });
});

describe('plan, behaviour', () => {
  it('shows each agent\u2019s retries, failure policy and escalation', () => {
    const write = plan(parsed).workflows[0]?.nodes.find((n) => n.id === 'write');
    expect(write).toMatchObject({
      retries: 1,
      onFailure: 'stop-run',
      escalatesTo: 'owner',
      needsApproval: true,
    });
  });
});
