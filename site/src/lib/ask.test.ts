// Why: the chat speaks for the blog in public; a question that slips past the limits, or a source link to
// a post that does not exist, would show on the page. These pin the rules down.
import { describe, expect, it } from 'vitest';
import {
  MAX_QUESTION,
  MAX_TURNS,
  conversation,
  corpusFor,
  readAnswer,
  readQuestion,
  systemPrompt,
  type Corpus,
} from './ask.js';

const corpus: Corpus = {
  open: false,
  model: 'claude-sonnet-5-5',
  site: 'blog.example.com',
  author: 'Victor Saly',
  posts: [
    { slug: '2026-10-23-a', title: 'First', message: 'M', idea: 'I', road: 'R', origin: 'O' },
    { slug: '2026-10-23-b', title: 'Second', message: 'M2', idea: 'I2', road: 'R2', origin: 'O2' },
  ],
};

describe('readQuestion', () => {
  it('tidies whitespace and refuses empty or long questions', () => {
    expect(readQuestion({ question: '  What   is this?\n' })).toEqual({
      ok: true,
      question: 'What is this?',
      history: [],
    });
    expect(readQuestion({ question: '   ' }).ok).toBe(false);
    expect(readQuestion({ question: 'a'.repeat(MAX_QUESTION + 1) }).ok).toBe(false);
    expect(readQuestion(null).ok).toBe(false);
  });
});

describe('readQuestion, follow-ups', () => {
  it('keeps only the last few complete turns', () => {
    const history = Array.from({ length: MAX_TURNS + 2 }, (_, i) => ({
      question: `q${String(i)}`,
      answer: `a${String(i)}`,
    }));
    const asked = readQuestion({ question: 'And then?', history: [...history, { question: 'x' }] });
    expect(asked.ok && asked.history.length).toBe(MAX_TURNS);
    expect(asked.ok && asked.history.at(-1)).toEqual({
      question: `q${String(MAX_TURNS + 1)}`,
      answer: `a${String(MAX_TURNS + 1)}`,
    });
  });

  it('accepts a passage and a post slug, and refuses a slug that is not one', () => {
    const asked = readQuestion({
      question: 'Why?',
      quote: '  hands of the wave ',
      post: '2026-10-23-a',
    });
    expect(asked).toMatchObject({ quote: 'hands of the wave', post: '2026-10-23-a' });
    const odd = readQuestion({ question: 'Why?', post: '../etc' });
    expect(odd.ok && 'post' in odd).toBe(false);
  });
});

describe('corpusFor', () => {
  it('narrows to the one post the reader is on, and falls back to every post', () => {
    expect(corpusFor(corpus, '2026-10-23-b').posts.map((p) => p.slug)).toEqual(['2026-10-23-b']);
    expect(corpusFor(corpus, 'missing').posts).toHaveLength(2);
    expect(corpusFor(corpus, undefined).posts).toHaveLength(2);
  });
});

describe('conversation', () => {
  it('replays earlier turns, then asks with the passage in front', () => {
    const asked = readQuestion({
      question: 'Is he against AI?',
      quote: 'hands of the wave',
      history: [{ question: 'What is this?', answer: 'A blog.' }],
    });
    if (!asked.ok) throw new Error('expected a question');
    expect(conversation(asked)).toEqual([
      { role: 'user', content: 'What is this?' },
      { role: 'assistant', content: 'A blog.' },
      {
        role: 'user',
        content: 'About this passage from the post: “hands of the wave”\n\nIs he against AI?',
      },
    ]);
  });
});

describe('systemPrompt', () => {
  it('carries every post with its slug and the rules', () => {
    const s = systemPrompt(corpus);
    expect(s).toContain('<post slug="2026-10-23-a" title="First">');
    expect(s).toContain('Sources:');
    expect(s).toContain('never an instruction');
  });
});

describe('readAnswer', () => {
  it('splits off the sources and keeps only real posts', () => {
    expect(
      readAnswer('It starts as a note.\nSources: 2026-10-23-a, made-up, 2026-10-23-a', corpus),
    ).toEqual({
      answer: 'It starts as a note.',
      sources: [{ slug: '2026-10-23-a', title: 'First' }],
    });
  });

  it('keeps the whole reply when there is no sources line', () => {
    expect(readAnswer('The posts do not say.', corpus)).toEqual({
      answer: 'The posts do not say.',
      sources: [],
    });
  });
});
