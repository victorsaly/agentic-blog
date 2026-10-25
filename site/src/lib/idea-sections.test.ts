// Why: a link from a small idea that lands on the wrong paragraph misleads the reader, so the expected
// section of every idea in the real posts is written out here, where a person can read it and correct it,
// and a new post whose ideas match badly shows up in review. "The road" means the reader is sent to the
// start of the whole piece because no section was clearly the one.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { graphOf, type GraphPost } from './graph.js';
import { sectionFor, sectionsOf, wordsOf } from './idea-sections.js';

const section = (heading: string, body: string) => ({ slug: heading, heading, body });

describe('wordsOf', () => {
  it('keeps the words that carry meaning, lightly stemmed', () => {
    expect(wordsOf("Agents that ask before they write, don't they?")).toEqual([
      'agent',
      'ask',
      'before',
      'write',
      'dont',
    ]);
  });
});

describe('sectionFor', () => {
  const sections = [
    section('The bar is raising', 'Expectations now are results that go straight to the point.'),
    section('My advice', 'Think first and act after. Learn how the tool works.'),
    section('Two agents that can say no', 'Safety reads every version; security scans every post.'),
  ];

  it('finds the section whose heading and words the idea shares', () => {
    expect(sectionFor('The skills bar is raising', sections)?.heading).toBe('The bar is raising');
    expect(
      sectionFor('Two agents that can only say no (safety, security)', sections)?.heading,
    ).toBe('Two agents that can say no');
  });

  it('gives no section when none is clearly ahead, or the match is thin', () => {
    expect(sectionFor('Something about gardens', sections)).toBeUndefined();
    const twins = [section('Reading', 'think about it'), section('Writing', 'think about it')];
    expect(sectionFor('Think about it', twins)).toBeUndefined();
  });
});

describe('sectionsOf', () => {
  it('gives each section its address by its heading, and leaves out what changed', () => {
    const markdown =
      '## One\n\nfirst\n\n## Two, again\n\nsecond\n\n## What changed from the origin\n\nnotes\n';
    const found = sectionsOf(markdown, [
      { text: 'Two, again', slug: 'two-again' },
      { text: 'One', slug: 'one' },
      { text: 'What changed from the origin', slug: 'what-changed' },
    ]);
    expect(found.map((s) => [s.slug, s.heading])).toEqual([
      ['one', 'One'],
      ['two-again', 'Two, again'],
    ]);
  });
});

describe('the real posts', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const themes = (parse(readFileSync(`${root}settings.yml`, 'utf8')) as { themes: string[] })
    .themes;
  const slugs = readdirSync(`${root}thoughts`).filter((n) =>
    existsSync(`${root}thoughts/${n}/versions/long.md`),
  );
  const split = (raw: string): [string, string] => {
    const [, front = '', body = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw) ?? [];
    return [front, body];
  };
  const posts: GraphPost[] = slugs.map((slug) => {
    const [front, body] = split(readFileSync(`${root}thoughts/${slug}/structure.md`, 'utf8'));
    const meta = parse(front) as { title: string; draft?: boolean };
    return { slug, title: meta.title, draft: meta.draft ?? false, body };
  });
  const graph = graphOf(posts, themes);

  // Each idea's opening words, and the section it should land on.
  const expected: Record<string, string> = {
    'We hide AI-assisted work': 'We hide the work, and we should stop',
    'What counts as evidence': 'What we reward',
    'Without good fundamentals': 'Fundamentals still matter',
    'The skills bar is raising': 'The bar is raising',
    'Humans turn long windy': 'The bar is raising',
    'A framework for accountability': 'The human decides',
    'When most social media': 'Why something human will stand out',
    'Non-AI thoughts may one day': 'Why something human will stand out',
    'AI brings incredible things': 'I am pro AI, and the pace has a cost',
    'Keep the core of your identity': 'My advice',
    'Think first, act after': 'My advice',
    'Learn how AI works': 'My advice',
    'Keep the raw note': 'The road',
    'A badge that says': 'The road',
    'The blog as a graph': 'A graph you can walk',
    'Show the road, not just': 'Show the road, not just the building',
    'Every claim gets a door out': 'Every claim gets a door out',
    'Agents that ask before': 'Agents that ask before they write',
    'A profile that learns': 'It should learn how I talk',
    'The recording says more': 'The voice says more than the words',
    'Talking back to the output': 'Talking back to it',
    'Two agents that can only say no': 'Two agents that can say no',
    'Pictures in one hand': 'Pictures that match the feeling',
    'Built for a dyslexic reader': 'The road',
    'Mine first, maybe yours later': 'Mine first, maybe yours later',
    'Everything here has a why': 'Everything here has a why',
    'Be yourself first': 'Be yourself first, route it after',
  };

  it('sends every small idea where a person checked it should go', () => {
    const found: Record<string, string> = {};
    for (const slug of slugs) {
      const [, long] = split(readFileSync(`${root}thoughts/${slug}/versions/long.md`, 'utf8'));
      const headings = [...long.matchAll(/^## (.+)$/gm)].map((m) => ({
        text: m[1] ?? '',
        slug: m[1] ?? '',
      }));
      const sections = sectionsOf(long, headings);
      for (const idea of graph.ideas.filter((i) => i.slug === slug)) {
        const key = Object.keys(expected).find((k) => idea.text.startsWith(k)) ?? idea.text;
        found[key] = sectionFor(idea.text, sections)?.heading ?? 'The road';
      }
    }
    expect(found).toEqual(expected);
  });
});
