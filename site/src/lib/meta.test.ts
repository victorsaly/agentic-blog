// Why: every page's description and canonical address come from these; a broken one shows in every search
// result and link preview.
import { describe, expect, it } from 'vitest';
import { breadcrumbs, cleanPath, metaDescription } from './meta.js';

describe('metaDescription', () => {
  it('keeps a short message whole', () => {
    expect(metaDescription('Short and whole.')).toBe('Short and whole.');
  });

  it('cuts a long message at the last whole sentence that fits', () => {
    const message =
      'AI-assisted work is not cheating, and we should stop hiding it. The skills bar is raising, and the one who decides what sits and what does not is still the human. Think first.';
    const d = metaDescription(message);
    expect(d).toBe('AI-assisted work is not cheating, and we should stop hiding it.');
    expect(d.length).toBeLessThanOrEqual(155);
  });

  it('cuts one long sentence at a word, with an ellipsis', () => {
    const d = metaDescription(`${'word '.repeat(60)}end`);
    expect(d.endsWith('…')).toBe(true);
    expect(d.length).toBeLessThanOrEqual(155);
  });
});

describe('cleanPath', () => {
  it('drops .html and keeps the home page as /', () => {
    expect(cleanPath('/thoughts/2026-10-23-a.html')).toBe('/thoughts/2026-10-23-a');
    expect(cleanPath('/index.html')).toBe('/');
    expect(cleanPath('/')).toBe('/');
  });
});

describe('breadcrumbs', () => {
  it('numbers each step from the home page down', () => {
    expect(
      breadcrumbs([
        { name: 'Home', url: 'https://b.example/' },
        { name: 'Topics', url: 'https://b.example/topics' },
      ]),
    ).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://b.example/' },
        { '@type': 'ListItem', position: 2, name: 'Topics', item: 'https://b.example/topics' },
      ],
    });
  });
});
