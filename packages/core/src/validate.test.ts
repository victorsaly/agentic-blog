// Why: these tests are the accountability rules written as examples. If one of them starts passing a
// project it should refuse, a rule has quietly stopped existing, and that must fail the build.
import { describe, expect, it } from 'vitest';
import { validate } from './validate.js';
import { card, project } from './fixture.test-helper.js';
import type { ProjectInput } from './schema.js';

type Nodes = ProjectInput['workflows'][number]['nodes'];

function withNodes(edit: (nodes: Nodes) => Nodes): ProjectInput {
  const p = project();
  const [wf] = p.workflows;
  if (!wf) throw new Error('fixture has a workflow');
  return { ...p, workflows: [{ ...wf, nodes: edit({ ...wf.nodes }) }] };
}

const rulesOf = (input: unknown): string[] => validate(input).issues.map((i) => i.rule);

describe('a sound project', () => {
  it('passes with no issues', () => {
    const result = validate(project());
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('RB010: a person approves before anything leaves', () => {
  it('refuses a sink with no gate in front of it', () => {
    const input = withNodes(({ approve: _removed, ...rest }) => ({
      ...rest,
      publish: {
        kind: 'sink',
        why: 'The draft goes straight out, which Roadbook must refuse.',
        after: ['write'],
        target: { kind: 'github-pr', repo: 'owner/repo' },
      },
    }));
    const result = validate(input);
    expect(result.ok).toBe(false);
    expect(result.issues.find((i) => i.rule === 'RB010')?.message).toMatch(
      /without a person approving/,
    );
  });

  it('refuses a sink that one path reaches around the gate', () => {
    const input = withNodes((nodes) => ({
      ...nodes,
      publish: {
        kind: 'sink',
        why: 'Reached by the approved path and by a side path that skips the gate.',
        after: ['approve', 'write'],
        target: { kind: 'github-pr', repo: 'owner/repo' },
      },
    }));
    expect(rulesOf(input)).toContain('RB010');
  });

  it('does not count a gate that only asks a question as approval', () => {
    const input = withNodes((nodes) => ({
      ...nodes,
      approve: {
        kind: 'gate',
        why: 'Asks for an answer, which is not the same as approving the result.',
        after: ['write'],
        asks: 'answer',
        question: 'Anything to add?',
      },
    }));
    expect(rulesOf(input)).toContain('RB010');
  });

  it('cannot be switched off: there is no field for it', () => {
    const input = {
      ...project(),
      accountability: { ...project().accountability, overrideNeedsReason: false },
    };
    expect(validate(input).ok).toBe(false);
  });
});

describe('graph rules', () => {
  it('RB020: refuses a link to a node that does not exist', () => {
    const input = withNodes((nodes) => ({
      ...nodes,
      write: {
        kind: 'agent',
        why: 'Waits for a node that is missing.',
        after: ['ghost'],
        card: card('write'),
      },
    }));
    expect(rulesOf(input)).toContain('RB020');
  });

  it('RB021: refuses a loop', () => {
    const input = withNodes((nodes) => ({
      ...nodes,
      write: {
        kind: 'agent',
        why: 'Waits for the gate that waits for it, a loop.',
        after: ['origin', 'approve'],
        card: card('write'),
      },
    }));
    expect(rulesOf(input)).toContain('RB021');
  });

  it('RB022: refuses a workflow that starts anywhere but an input', () => {
    const input = withNodes((nodes) => ({
      ...nodes,
      stray: {
        kind: 'tool',
        why: 'A tool waiting for nothing at all.',
        does: 'Counts words in nothing.',
      },
    }));
    expect(rulesOf(input)).toContain('RB022');
  });
});

describe('agent rules', () => {
  it('RB031: refuses a draft agent on the way to a sink', () => {
    const input = withNodes((nodes) => ({
      ...nodes,
      write: {
        kind: 'agent',
        why: 'Not yet trialled, so it may not touch real work.',
        after: ['origin'],
        card: card('write', { stage: 'draft' }),
      },
    }));
    expect(rulesOf(input)).toContain('RB031');
  });

  it('RB032: refuses an agent whose card asks for a gate that is not there', () => {
    const input = withNodes((nodes) => ({
      ...nodes,
      check: {
        kind: 'tool',
        why: 'Sits between the agent and the gate, so the gate is not directly after it.',
        after: ['write'],
        does: 'Counts the words in the draft.',
      },
      approve: {
        kind: 'gate',
        why: 'Approves after the tool, not after the agent.',
        after: ['check'],
        asks: 'approve',
        question: 'Publish this draft?',
      },
    }));
    expect(rulesOf(input)).toContain('RB032');
  });

  it('RB040: refuses a provider the card does not allow', () => {
    const p = project();
    const input = withNodes((nodes) => ({
      ...nodes,
      write: {
        kind: 'agent',
        why: 'Asked to run on a model its card has not been tested on.',
        after: ['origin'],
        provider: 'other',
        card: card('write'),
      },
    }));
    const withOther = {
      ...input,
      providers: { ...p.providers, other: { kind: 'openai' as const } },
      data: {
        ...p.data,
        exits: {
          ...p.data.exits,
          other: {
            sends: ['text' as const],
            region: 'eu' as const,
            retention: 'zero' as const,
            why: 'Another writing model, declared so only RB040 is tested.',
          },
        },
      },
    };
    expect(rulesOf(withOther)).toContain('RB040');
  });

  it('RB060: warns, but does not refuse, an agent with no test set', () => {
    const result = validate(project(), { testCounts: { write: 0 } });
    expect(result.ok).toBe(true);
    expect(result.issues.map((i) => [i.rule, i.severity])).toContainEqual(['RB060', 'warning']);
  });
});

describe('data rules', () => {
  it('RB041: refuses a provider with no declared exit', () => {
    const p = project();
    const input = {
      ...p,
      providers: { ...p.providers, images: { kind: 'openai-images' as const } },
    };
    expect(rulesOf(input)).toContain('RB041');
  });

  it('RB042: refuses an exit outside the allowed regions', () => {
    const p = project();
    const input = {
      ...p,
      data: {
        ...p.data,
        exits: {
          writer: {
            sends: ['text' as const],
            region: 'us' as const,
            retention: 'zero' as const,
            why: 'Moved to a region the owner has not allowed.',
          },
        },
      },
    };
    expect(rulesOf(input)).toContain('RB042');
  });

  it('RB043: refuses an agent sending a kind of data its exit does not allow', () => {
    const input = withNodes((nodes) => ({
      ...nodes,
      write: {
        kind: 'agent',
        why: 'Wants to send the recording, which the exit does not allow.',
        after: ['origin'],
        card: card('write', { data: { sends: ['text', 'audio'] } }),
      },
    }));
    expect(rulesOf(input)).toContain('RB043');
  });

  it('refuses a project not hosted in the owner’s account', () => {
    const p = project();
    expect(validate({ ...p, data: { ...p.data, host: 'roadbook-cloud' } }).ok).toBe(false);
  });
});

describe('flow rules', () => {
  it('RB050: refuses capacity on something that is not a gate', () => {
    const p = project();
    expect(rulesOf({ ...p, flow: { capacity: { write: { perDay: 2 } } } })).toContain('RB050');
  });
});
