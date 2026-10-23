// Why: a drawing in the wrong section, or one shown without alt text, is a mistake every reader sees.
// These pin down which drawings are used and where each one lands.
import { describe, expect, it } from 'vitest';
import { coverOf, insertSectionPictures, picturesFrom, type MdNode } from './pictures.js';

const list = {
  images: [
    {
      file: 'image/00-person-thinking.png',
      section: 'cover',
      alt: 'A person thinking.',
      drawn: true,
    },
    {
      file: 'image/01-hiding-screen.png',
      section: 'We hide the work',
      alt: 'An arm over a screen.',
      drawn: true,
    },
    { file: 'image/02-not-drawn.png', section: 'What we reward', alt: 'Missing.', drawn: false },
    { file: '../escape.png', section: 'My advice', alt: 'Unsafe path.', drawn: true },
    { file: 'image/04-no-alt.png', section: 'My advice', alt: '  ', drawn: true },
  ],
};

describe('picturesFrom', () => {
  it('keeps only drawn pictures with a safe file and alt text', () => {
    expect(picturesFrom(list).map((p) => p.file)).toEqual([
      'image/00-person-thinking.png',
      'image/01-hiding-screen.png',
    ]);
    expect(picturesFrom(null)).toEqual([]);
  });

  it('finds the cover', () => {
    expect(coverOf(picturesFrom(list))?.file).toBe('image/00-person-thinking.png');
  });
});

describe('insertSectionPictures', () => {
  it('puts the drawing right after its heading, matching by words', () => {
    const tree: MdNode = {
      type: 'root',
      children: [
        { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Title' }] },
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'We hide the work' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'Body.' }] },
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'What we reward' }] },
      ],
    };
    expect(insertSectionPictures(tree, picturesFrom(list))).toBe(1);
    expect(tree.children?.[2]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'image', url: '../image/01-hiding-screen.png', alt: 'An arm over a screen.' },
      ],
    });
    expect(tree.children).toHaveLength(5);
  });
});

describe('captions', () => {
  it('puts the quoted line and the note under a drawing, only when there are any', () => {
    const tree: MdNode = {
      type: 'root',
      children: [{ type: 'heading', depth: 2, children: [{ type: 'text', value: 'My advice' }] }],
    };
    const placed = insertSectionPictures(tree, [
      {
        file: 'image/01-x.png',
        section: 'My advice',
        alt: 'A desk.',
        quote: 'Think first, act after.',
        note: 'The pen waits.',
      },
    ]);
    expect(placed).toBe(1);
    expect(tree.children?.[2]).toEqual({
      type: 'paragraph',
      data: { hProperties: { className: ['caption'] } },
      children: [
        { type: 'emphasis', children: [{ type: 'text', value: '“Think first, act after.”' }] },
        { type: 'break' },
        { type: 'text', value: 'The pen waits.' },
      ],
    });
  });
});
