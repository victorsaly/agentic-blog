// Why: the chat speaks for the blog in public; a question that slips past the limits, or a source link to
// a post that does not exist, would show on the page. These pin the rules down.
import { describe, expect, it } from 'vitest';
import { MAX_QUESTION, readAnswer, readQuestion, systemPrompt, type Corpus } from './ask.js';

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
    });
    expect(readQuestion({ question: '   ' }).ok).toBe(false);
    expect(readQuestion({ question: 'a'.repeat(MAX_QUESTION + 1) }).ok).toBe(false);
    expect(readQuestion(null).ok).toBe(false);
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
