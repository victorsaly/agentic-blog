// Why: the studio shows agents' files and Victor's own words through this; a misread table or list makes a
// structure unreviewable, and a link or tag let through would put something on the page no file should.
import { describe, expect, it } from 'vitest';
import { blocksOf, inlineOf, isSafeHref } from './markdown-view';

describe('blocksOf', () => {
  it('reads the questions an interview writes: a numbered list, wrapped lines kept with their item', () => {
    const blocks = blocksOf(
      '1. What would you call this?\n2. Where were you,\n   and when?\n\n- One more thing.',
    );
    expect(blocks).toEqual([
      {
        kind: 'list',
        ordered: true,
        items: [
          [{ kind: 'text', text: 'What would you call this?' }],
          [{ kind: 'text', text: 'Where were you, and when?' }],
        ],
      },
      { kind: 'list', ordered: false, items: [[{ kind: 'text', text: 'One more thing.' }]] },
    ]);
  });

  it('reads a structure: headings one level down, paragraphs, and the small ideas table', () => {
    const blocks = blocksOf(
      '# The message\n\nTalk first, **tidy** after.\n\n## Small ideas\n\n| Idea | Topics |\n| --- | --- |\n| Keep the origin | ai, writing |\n| One colour | design |',
    );
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'para', 'heading', 'table']);
    expect(blocks[0]).toMatchObject({ level: 2 });
    const table = blocks[3];
    expect(table?.kind === 'table' && table.rows.length).toBe(2);
    expect(table?.kind === 'table' && table.rows[1]?.[1]).toEqual([
      { kind: 'text', text: 'design' },
    ]);
  });

  it('keeps a fenced block exactly, so a diagram in text keeps its alignment', () => {
    const diagram = '[ talk ] ──> [ tidy ]\n    │\n    └──> [ origin ]';
    expect(blocksOf(`Before.\n\n\`\`\`\n${diagram}\n\`\`\`\n\nAfter.`)).toEqual([
      { kind: 'para', parts: [{ kind: 'text', text: 'Before.' }] },
      { kind: 'code', text: diagram },
      { kind: 'para', parts: [{ kind: 'text', text: 'After.' }] },
    ]);
  });

  it('keeps a quote, and HTML as plain words', () => {
    expect(blocksOf('> said once\n\n<b>not bold</b>')).toEqual([
      { kind: 'quote', parts: [{ kind: 'text', text: 'said once' }] },
      { kind: 'para', parts: [{ kind: 'text', text: '<b>not bold</b>' }] },
    ]);
  });
});

describe('inlineOf', () => {
  it('reads bold, italic, code and links', () => {
    expect(
      inlineOf('A **b** *i* _u_ `c` [d](https://e.org) [f](/thoughts/x)').map((p) => p.kind),
    ).toEqual([
      'text',
      'bold',
      'text',
      'italic',
      'text',
      'italic',
      'text',
      'code',
      'text',
      'link',
      'text',
      'link',
    ]);
  });

  it('makes a link only of a web address or a place on the site', () => {
    expect(isSafeHref('https://example.org/a')).toBe(true);
    expect(isSafeHref('/studio/agents')).toBe(true);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('//elsewhere.org')).toBe(false);
    expect(inlineOf('[x](javascript:alert(1))')[0]).toMatchObject({ kind: 'text' });
  });
});
