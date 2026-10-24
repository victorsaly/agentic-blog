// Why: the tests need a small, valid project to start from and then break one thing at a time. Keeping it
// in one place means each test reads as "this project, minus the gate" rather than fifty lines of setup.
import type { AgentCardInput, ProjectInput } from './schema.js';

export function card(name: string, overrides: Partial<AgentCardInput> = {}): AgentCardInput {
  const defaults: AgentCardInput = {
    name,
    phase: 1,
    reads: ['origin'],
    writes: ['draft'],
    purpose: `Does the ${name} step of the test workflow.`,
    why: 'A test agent, here so the rules have something real to check.',
    inputs: [{ name: 'origin', type: 'text' }],
    outputs: [{ name: 'draft', type: 'markdown' }],
    mustNot: ['Add facts that are not in the origin.'],
    doneMeans: [{ id: 'has-draft', says: 'A draft exists and is not empty.' }],
    qualityBar: { approvedWithoutRewrite: 0.9 },
    model: { default: 'writer', allowed: ['writer'] },
    budget: { usdPerRun: 0.05, secondsPerRun: 60 },
    behaviour: {
      needsApproval: true,
      retry: { max: 1, on: ['check-failed', 'provider-error'] },
      onFailure: 'stop-run',
      escalate: {
        when: ['retries-exhausted', 'held'],
        to: 'owner',
        says: 'The draft could not be written; have a look.',
      },
    },
    metrics: [
      {
        id: 'approved-without-rewrite',
        says: 'Share of drafts approved as written.',
        target: 0.9,
        direction: 'at-least',
        unit: 'share',
      },
    ],
    data: { sends: ['text'] },
    owner: 'Test Owner',
    version: '1.0.0',
    stage: 'active',
    tests: 3,
  };
  return {
    ...defaults,
    ...overrides,
    phase: overrides.phase ?? defaults.phase,
    reads: overrides.reads ?? defaults.reads,
    writes: overrides.writes ?? defaults.writes,
  };
}

export function project(): ProjectInput {
  return {
    name: 'test-project',
    why: 'A minimal project that passes every rule, used as the starting point for each test.',
    owner: { name: 'Test Owner', email: 'owner@example.com' },
    accountability: {
      disclosure: { left: 'Written by AI', right: 'My original' },
      replay: 'per-item',
      overrideNeedsReason: true,
    },
    data: {
      host: 'owner-account',
      home: 'uk',
      allowedRegions: ['uk', 'eu'],
      personalData: 'hold-for-review',
      exits: {
        writer: {
          sends: ['text'],
          region: 'eu',
          retention: 'zero',
          why: 'The writing model receives the text it is asked to tidy, and nothing else.',
        },
      },
    },
    providers: { writer: { kind: 'claude', model: 'test-model', secret: 'ANTHROPIC_API_KEY' } },
    budget: { monthlyCapUsd: 10, atCap: 'queue' },
    flow: { capacity: { approve: { perDay: 2 } } },
    workflows: [
      {
        id: 'post',
        why: 'Turns one origin into one draft that a person approves before it leaves.',
        nodes: {
          origin: {
            kind: 'input',
            why: 'Where a run starts: the person says something.',
            accepts: ['text', 'audio'],
          },
          write: {
            kind: 'agent',
            why: 'Tidies the origin into a draft a reader can follow.',
            after: ['origin'],
            card: card('write'),
          },
          approve: {
            kind: 'gate',
            why: 'Nothing leaves until the owner has read it.',
            after: ['write'],
            asks: 'approve',
            question: 'Publish this draft?',
          },
          publish: {
            kind: 'sink',
            why: 'The approved draft becomes a pull request the owner merges.',
            after: ['approve'],
            target: { kind: 'github-pr', repo: 'owner/repo' },
          },
        },
      },
    ],
    runtime: {
      kind: 'cloudflare',
      worker: 'test-worker',
      domain: 'example.com',
      access: ['owner@example.com'],
      buckets: ['raw'],
    },
  };
}
