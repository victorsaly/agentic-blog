// Why: a diagram the site cannot place, or one with an empty box, would show as a broken figure in a
// post; the plan is checked before anything is written.
import { describe, expect, it } from 'vitest';
import { inKnownSections, plan } from './index.js';

const flowDiagram = {
  section: 'How a note becomes a post',
  kind: 'flow' as const,
  title: 'From voice note to post',
  caption: 'Every post walks this road.',
  steps: [{ label: 'Talk into the phone' }, { label: 'Agents convert' }, { label: 'I merge' }],
};

describe('diagram plan', () => {
  it('accepts a flow and a compare, and an empty list', () => {
    expect(
      plan.safeParse({ why: 'Two sections explain a change in order.', diagrams: [flowDiagram] })
        .success,
    ).toBe(true);
    expect(
      plan.safeParse({ why: 'Nothing here is a process or a contrast.', diagrams: [] }).success,
    ).toBe(true);
  });

  it('refuses a flow with one step or an empty label', () => {
    expect(
      plan.safeParse({
        why: 'x'.repeat(20),
        diagrams: [{ ...flowDiagram, steps: [{ label: 'Only' }] }],
      }).success,
    ).toBe(false);
    expect(
      plan.safeParse({ why: 'x'.repeat(20), diagrams: [{ ...flowDiagram, title: ' ' }] }).success,
    ).toBe(false);
  });

  it('drops a diagram whose section is not a heading', () => {
    expect(inKnownSections([flowDiagram], ['My advice'])).toEqual([]);
    expect(inKnownSections([flowDiagram], ['How a note becomes a post'])).toHaveLength(1);
  });
});
