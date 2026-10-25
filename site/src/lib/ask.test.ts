// Why: the chat speaks for the blog in public; a question that slips past the limits, or a source link to
// a post that does not exist, would show on the page. These pin the rules down.
import { describe, expect, it } from 'vitest';
import {
  MAX_CHARS,
  MAX_POSTS,
  MAX_QUESTION,
  MAX_TURNS,
  conversation,
  corpusFor,
  corpusText,
  readAnswer,
  readQuestion,
  relevantCorpus,
  systemPrompt,
  type Corpus,
  type Question,
} from './ask.js';

const first = {
  slug: '2026-10-23-a',
  title: 'First',
  message: 'M',
  idea: 'I',
  road: 'R',
  origin: 'O',
};
const corpus: Corpus = {
  open: false,
  model: 'claude-sonnet-5-5',
  site: 'blog.example.com',
  author: 'Victor Saly',
  posts: [
    first,
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
  it('carries every post with its slug, its places and the rules', () => {
    const s = systemPrompt(corpus);
    expect(s).toContain('<post slug="2026-10-23-a" title="First">');
    expect(s).toContain('/thoughts/2026-10-23-a/origin | The origin, as it came out');
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
      places: [],
    });
  });

  it('keeps the whole reply when there is no sources line', () => {
    expect(readAnswer('The posts do not say.', corpus)).toEqual({
      answer: 'The posts do not say.',
      sources: [],
      places: [],
    });
  });

  it('keeps links to real places and turns any other link back into words', () => {
    const withPlaces: Corpus = {
      ...corpus,
      posts: [{ ...first, places: [{ href: '/thoughts/2026-10-23-a#road', name: 'The road' }] }],
    };
    const read = readAnswer(
      'See [the road](/thoughts/2026-10-23-a#road), [the note](/thoughts/2026-10-23-a/origin) and [a guess](/thoughts/2026-10-23-a#nowhere) or [elsewhere](https://example.com).\nSources: 2026-10-23-a',
      withPlaces,
    );
    expect(read.answer).toBe(
      'See [the road](/thoughts/2026-10-23-a#road), [the note](/thoughts/2026-10-23-a/origin) and a guess or elsewhere.',
    );
    expect(read.places).toEqual([
      { href: '/thoughts/2026-10-23-a#road', name: 'The road', post: 'First' },
      { href: '/thoughts/2026-10-23-a/origin', name: 'The origin, as it came out', post: 'First' },
    ]);
  });
});

describe('relevantCorpus', () => {
  const asked = (question: string, more: Partial<Extract<Question, { ok: true }>> = {}) => ({
    ok: true as const,
    question,
    history: [],
    ...more,
  });
  const fuller: Corpus = {
    ...corpus,
    posts: [
      {
        ...first,
        road: 'A long road about linocut prints and ink.',
        ideas: [{ text: 'Pictures in one hand', topics: ['AI changing work'] }],
        sources: '- "linocut" → Wikipedia: https://example.org/linocut',
      },
      {
        slug: '2026-10-23-b',
        title: 'Second',
        message: 'About budgets',
        idea: 'Money',
        road: 'Every call is priced before it is made.',
        origin: 'O2',
        made: 'Agents that worked on it: convert (1 run). Recorded cost £0.12.',
      },
    ],
    pages: [
      { href: '/how-it-works', title: 'How it works', text: 'Agents, one job each.', always: true },
      { href: '/topics', title: 'Topics', text: 'Credibility: what makes people believe you.' },
    ],
  };

  it('sends the post that matches the question whole, and leaves the others out', () => {
    const picked = relevantCorpus(fuller, asked('Where do the linocut prints come from?'));
    expect(picked.posts.map((p) => p.slug)).toEqual(['2026-10-23-a']);
    expect(picked.posts[0]?.road).toContain('linocut');
    expect(picked.brief).toBeUndefined();
  });

  it('finds a match in what was made and in the sources, not only the text', () => {
    expect(relevantCorpus(fuller, asked('What did the convert agent cost?')).posts[0]?.slug).toBe(
      '2026-10-23-b',
    );
  });

  it('always sends the pages marked always, and a page only when it matches otherwise', () => {
    const plain = relevantCorpus(fuller, asked('linocut'));
    expect(plain.pages?.map((p) => p.href)).toEqual(['/how-it-works']);
    const topical = relevantCorpus(fuller, asked('What makes people believe you?'));
    expect(topical.pages?.map((p) => p.href)).toEqual(['/how-it-works', '/topics']);
  });

  it('falls back to every post in short form when nothing matches', () => {
    const picked = relevantCorpus(fuller, asked('zzz qqq'));
    expect(picked.brief).toBe(true);
    expect(picked.posts).toHaveLength(2);
    expect(picked.posts.every((p) => p.road === '' && p.origin === '' && !('sources' in p))).toBe(
      true,
    );
    expect(picked.posts[0]?.ideas).toHaveLength(1);
  });

  it('uses the last question of the thread for a follow-up', () => {
    const picked = relevantCorpus(
      fuller,
      asked('Which agents worked on it?', {
        history: [{ question: 'Tell me about budgets', answer: 'Money.' }],
      }),
    );
    expect(picked.posts.map((p) => p.slug)).toEqual(['2026-10-23-b']);
  });

  it('keeps to the one post the reader is on, with the always pages', () => {
    const picked = relevantCorpus(fuller, asked('linocut', { post: '2026-10-23-b' }));
    expect(picked.posts.map((p) => p.slug)).toEqual(['2026-10-23-b']);
    expect(picked.pages?.map((p) => p.href)).toEqual(['/how-it-works']);
  });

  it('never sends more than MAX_POSTS', () => {
    const many: Corpus = {
      ...corpus,
      posts: Array.from({ length: 8 }, (_, i) => ({
        ...first,
        slug: `2026-01-0${String(i + 1)}-p`,
        road: 'linocut linocut',
      })),
    };
    expect(relevantCorpus(many, asked('linocut')).posts).toHaveLength(MAX_POSTS);
  });
});

describe('corpusText and readAnswer, with the new parts', () => {
  const rich: Corpus = {
    ...corpus,
    posts: [
      {
        ...first,
        topics: ['Credibility'],
        ideas: [{ text: 'A badge that says tidied', topics: ['Credibility'] }],
        sources: '- a claim → a door',
        interview: 'Questions (not answered yet):\n1. Why?',
        made: 'Agents that worked on it: convert.',
      },
    ],
    pages: [{ href: '/how-it-works', title: 'How it works', text: 'Agents.' }],
  };

  it('writes every part a post has, and nothing for a part it has not', () => {
    const text = corpusText(rich);
    for (const part of ['topics', 'ideas', 'sources', 'interview', 'made'])
      expect(text).toContain(`<${part}>`);
    expect(text).toContain('<page href="/how-it-works" title="How it works">');
    expect(corpusText(corpus)).not.toContain('<sources>');
  });

  it('keeps a link to a page, as it keeps a link to a post', () => {
    const read = readAnswer('See [how](/how-it-works) and [else](/nowhere).\nSources: none', rich);
    expect(read.answer).toBe('See [how](/how-it-works) and else.');
    expect(read.places).toEqual([
      { href: '/how-it-works', name: 'How it works', post: 'How it works' },
    ]);
  });
});

describe('relevantCorpus, the edges', () => {
  const asked = (question: string, more: Partial<Extract<Question, { ok: true }>> = {}) => ({
    ok: true as const,
    question,
    history: [],
    ...more,
  });
  const two: Corpus = {
    ...corpus,
    posts: [
      { ...first, road: 'A road about linocut prints.' },
      {
        slug: '2026-10-23-b',
        title: 'Second',
        message: 'M2',
        idea: 'I2',
        road: 'A road about budgets and pence.',
        origin: 'O2',
      },
    ],
  };

  it('searches with the passage the reader picked, not only their words', () => {
    const picked = relevantCorpus(
      two,
      asked('Explain this in plain words', { quote: 'the linocut prints' }),
    );
    expect(picked.posts.map((p) => p.slug)).toEqual(['2026-10-23-a']);
  });

  it('sends the newest posts whole, within the budget, for a question its words cannot read', () => {
    const picked = relevantCorpus(two, asked('隐藏使用人工智能的研究是什么？'));
    expect(picked.brief).toBeUndefined();
    expect(picked.posts.map((p) => p.slug)).toEqual(['2026-10-23-b', '2026-10-23-a']);
    expect(picked.posts[0]?.road).toContain('budgets');
  });

  it('cuts an oversized first match to the budget instead of sending it whole', () => {
    const huge: Corpus = {
      ...corpus,
      posts: [{ ...first, road: 'linocut '.repeat(20_000), origin: 'o'.repeat(50_000) }],
    };
    const [only] = relevantCorpus(huge, asked('linocut')).posts;
    expect(JSON.stringify(only).length).toBeLessThanOrEqual(MAX_CHARS);
    expect(only?.road.endsWith('ask about this post for the rest]')).toBe(true);
    expect(only?.origin).toHaveLength(50_000);
    expect(only?.message).toBe('M');
  });
});
