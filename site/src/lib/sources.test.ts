// Why: a source number in the wrong place, or a door that silently drops, would mislead a reader about what
// a line rests on. These pin down how sources.md is read and where a claim lands.
import { describe, expect, it } from 'vitest';
import { carries, parseSources } from './sources';

const agentTable = `---
why: x
reviewed: false
---

# Sources

| Mentioned in the post | Door out | Opened | What is there |
|---|---|---|---|
| "We tend to hide AI-assisted work." (a claim) | [Over half hide it](https://example.com/survey) (Yahoo News, secondary) | 2026-10-23 | A survey of **48,000** people. |
| Same claim, second door | [Shadow AI](https://example.com/forbes) (Forbes) | 2026-10-23 | Why people hide it. |
| "Not slop" | [AI slop](https://en.wikipedia.org/wiki/AI_slop) (Wikipedia) | 2026-10-23 | A definition. |
| "Closed assumptions" | no door found | — | Nothing. |

## No door found, or not searched

- **"Hands of the wave".** Victor's own phrase.
- **"AI will not exist without us humans."** A conviction.
`;

const handTable = `| Mentioned in the post | Door out | Checked |
| --- | --- | --- |
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | 2026-10-23 |
| A book | wiki page to come | — |
`;

describe('parseSources', () => {
  const list = parseSources(agentTable);

  it('numbers each claim once, folding a second door into the claim above', () => {
    expect(list.claims.map((c) => c.quote)).toEqual([
      'We tend to hide AI-assisted work.',
      'Not slop',
    ]);
    expect(list.claims[0]?.doors.map((d) => d.url)).toEqual([
      'https://example.com/survey',
      'https://example.com/forbes',
    ]);
  });

  it('keeps the kind of source and what is there, without Markdown marks', () => {
    expect(list.claims[0]?.doors[0]).toEqual({
      label: 'Over half hide it',
      url: 'https://example.com/survey',
      note: '(Yahoo News, secondary)',
    });
    expect(list.claims[0]?.about).toBe('A survey of 48,000 people.');
  });

  it('leaves out a claim with no door, and lists the lines with no source', () => {
    expect(list.claims.some((c) => c.quote === 'Closed assumptions')).toBe(false);
    expect(list.unsourced).toEqual([
      '"Hands of the wave". Victor\'s own phrase.',
      '"AI will not exist without us humans." A conviction.',
    ]);
  });

  it('reads a hand-written table with bare links', () => {
    const hand = parseSources(handTable);
    expect(hand.claims).toEqual([
      {
        mention: 'WCAG 2.2',
        quote: 'WCAG 2.2',
        doors: [{ label: 'w3.org/TR/WCAG22', url: 'https://www.w3.org/TR/WCAG22/' }],
      },
    ]);
  });
});

describe('carries', () => {
  it('finds a claim in a lightly reworded paragraph', () => {
    expect(
      carries(
        'We tend to hide AI-assisted work. We treat it like cheating.',
        'We tend to hide AI-assisted work.',
      ),
    ).toBe(true);
  });

  it('does not place a claim where its words are missing', () => {
    expect(carries('The skills bar is raising.', 'We tend to hide AI-assisted work.')).toBe(false);
  });
});
