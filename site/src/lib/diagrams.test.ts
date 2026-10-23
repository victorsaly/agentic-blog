// Why: a diagram is drawn from data the agent wrote; an incomplete one must be skipped, and nothing it
// wrote may become markup on the page.
import { describe, expect, it } from 'vitest';
import { diagramHtml, diagramsFrom } from './diagrams.js';

const flow = {
  section: 'How it works',
  kind: 'flow',
  title: 'From note to post',
  caption: 'Every post walks this road.',
  steps: [{ label: 'Voice note', detail: 'Spoken into the phone.' }, { label: 'Converted' }],
};

describe('diagramsFrom', () => {
  it('keeps complete diagrams and skips broken ones', () => {
    const list = diagramsFrom({
      diagrams: [
        flow,
        { ...flow, steps: [{ label: 'Only one' }] },
        {
          section: 'X',
          kind: 'compare',
          title: 'T',
          caption: '',
          before: { label: 'A', items: ['one'] },
          after: { label: 'B', items: ['1', '2'] },
        },
      ],
    });
    expect(list).toHaveLength(1);
    expect(diagramsFrom(null)).toEqual([]);
  });
});

describe('diagramHtml', () => {
  it('draws a flow as an ordered list with title and caption', () => {
    const [d] = diagramsFrom({ diagrams: [flow] });
    expect(d && diagramHtml(d)).toBe(
      '<figure class="diagram diagram-flow"><p class="diagram-title">From note to post</p><ol class="flow"><li><span class="step">Voice note</span><span class="detail">Spoken into the phone.</span></li><li><span class="step">Converted</span></li></ol><figcaption>Every post walks this road.</figcaption></figure>',
    );
  });

  it('escapes anything that looks like markup', () => {
    const [d] = diagramsFrom({ diagrams: [{ ...flow, title: '<script>alert(1)</script>' }] });
    expect(d && diagramHtml(d)).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
