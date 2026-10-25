// Why: the chat draws whatever a model wrote; these pin down that only the small, safe part of Markdown it
// is asked for turns into anything, and that a link leaves the blog only as plain words.
import { describe, expect, it } from 'vitest';
import { blocksOf, inlineOf, isPlace, plainText } from './answer-text.js';

describe('isPlace', () => {
  it('accepts a post, its origin and a place inside them, nothing else', () => {
    expect(isPlace('/thoughts/2026-10-23-a')).toBe(true);
    expect(isPlace('/thoughts/2026-10-23-a#road')).toBe(true);
    expect(isPlace('/thoughts/2026-10-23-a/origin#origin-1--the-idea')).toBe(true);
    expect(isPlace('https://example.com')).toBe(false);
    expect(isPlace('javascript:alert(1)')).toBe(false);
    expect(isPlace('/thoughts/../studio')).toBe(false);
  });
});

describe('inlineOf', () => {
  it('reads bold and links to the blog, and keeps any other link as words', () => {
    expect(
      inlineOf('See **the road** and [section 2](/thoughts/a#two), not [this](https://x.y).'),
    ).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'bold', text: 'the road' },
      { kind: 'text', text: ' and ' },
      { kind: 'link', text: 'section 2', href: '/thoughts/a#two' },
      { kind: 'text', text: ', not ' },
      { kind: 'text', text: 'this' },
      { kind: 'text', text: '.' },
    ]);
  });
});

describe('blocksOf', () => {
  it('splits paragraphs and gathers list lines into one list', () => {
    const blocks = blocksOf(
      'It starts as a note.\nThen it is tidied.\n\nThree things:\n- one\n- two\n\nThe end.',
    );
    expect(blocks.map((b) => b.kind)).toEqual(['para', 'para', 'list', 'para']);
    expect(blocks[0]).toEqual({
      kind: 'para',
      parts: [{ kind: 'text', text: 'It starts as a note. Then it is tidied.' }],
    });
    expect(blocks[2]).toEqual({
      kind: 'list',
      items: [[{ kind: 'text', text: 'one' }], [{ kind: 'text', text: 'two' }]],
    });
  });
});

describe('plainText', () => {
  it('drops the stars and spells out the address of a link', () => {
    expect(
      plainText('**Yes.** Read [the road](/thoughts/a#road).', 'https://blog.example.com'),
    ).toBe('Yes. Read the road (https://blog.example.com/thoughts/a#road).');
  });
});

describe("isPlace, the site's own pages", () => {
  it('accepts how it works, the topics, the graph and a wiki file in the repository', () => {
    for (const href of [
      '/how-it-works',
      '/how-it-works#route',
      '/topics',
      '/topics/credibility',
      '/graph#t-credibility',
      'https://github.com/victorsaly/agentic-blog/blob/main/wiki/kurzweil.md',
    ])
      expect(isPlace(href), href).toBe(true);
    for (const href of [
      '/studio',
      '/topics/../studio',
      'https://github.com/victorsaly/agentic-blog/blob/main/.env',
      'https://github.com/someone-else/agentic-blog/blob/main/wiki/x.md',
    ])
      expect(isPlace(href), href).toBe(false);
  });

  it('keeps a wiki address whole when the answer is copied', () => {
    const wiki = 'https://github.com/victorsaly/agentic-blog/blob/main/wiki/kurzweil.md';
    expect(plainText(`See [the wiki](${wiki}).`, 'https://blog.example.com')).toBe(
      `See the wiki (${wiki}).`,
    );
  });
});
