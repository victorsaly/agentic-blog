import { describe, expect, it } from 'vitest';
import { escapeXml, rssXml, type Feed } from './feed';

const feed: Feed = {
  title: 'Victor Saly',
  link: 'https://blog.example.com',
  self: 'https://blog.example.com/rss.xml',
  description: 'Talked out loud, tidied by AI',
  language: 'en',
  items: [
    {
      title: 'Older',
      link: 'https://blog.example.com/thoughts/older',
      description: 'First.',
      date: new Date('2026-10-01T09:00:00Z'),
    },
    {
      title: 'Ideas & <tags>',
      link: 'https://blog.example.com/thoughts/newer',
      description: 'It\'s "quoted".',
      date: new Date('2026-10-23T09:00:00Z'),
    },
  ],
};

describe('escapeXml', () => {
  it('escapes the characters XML cares about', () => {
    expect(escapeXml(`a & b <c> "d" 'e'`)).toBe('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;');
  });
});

describe('rssXml', () => {
  const xml = rssXml(feed);

  it('lists the newest thought first', () => {
    expect(xml.indexOf('/thoughts/newer')).toBeLessThan(xml.indexOf('/thoughts/older'));
  });

  it('escapes titles and messages so the feed stays valid', () => {
    expect(xml).toContain('<title>Ideas &amp; &lt;tags&gt;</title>');
    expect(xml).toContain('<description>It&apos;s &quot;quoted&quot;.</description>');
  });

  it('dates each item the way feed readers expect', () => {
    expect(xml).toContain('<pubDate>Fri, 23 Oct 2026 09:00:00 GMT</pubDate>');
  });

  it('points at itself, so readers can tell where it lives', () => {
    expect(xml).toContain('<atom:link href="https://blog.example.com/rss.xml" rel="self"');
  });
});
