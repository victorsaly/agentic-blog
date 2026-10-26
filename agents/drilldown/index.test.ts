// Why: a wiki page the site's collection refuses would break the build, and one that skipped review would go
// live unread; what the agent writes is checked here without a model.
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { pagesFrom } from './index.js';

const page = (front: string, words = 40): string =>
  [
    '```markdown',
    '---',
    front,
    '---',
    '',
    Array.from({ length: words }, () => 'word').join(' '),
    '```',
  ].join('\n');

const copilot = page(
  [
    'why: The post says it used only Copilot for the game.',
    'title: GitHub Copilot',
    'kind: tool',
    'aliases:',
    '  - Copilot',
    'first_mentioned: wrong-slug',
    'reviewed: true',
  ].join('\n'),
);

describe('drilldown pages', () => {
  it('writes a page that waits for review and names this thought', () => {
    const { files } = pagesFrom(copilot, [], new Set(), '2026-10-25-september-last-year-tried');
    expect(files.map((f) => f.path)).toEqual(['wiki/github-copilot.md']);
    const { data } = matter(files[0]?.content ?? '');
    expect(data['reviewed']).toBe(false);
    expect(data['first_mentioned']).toBe('2026-10-25-september-last-year-tried');
    expect(data['aliases']).toEqual(['Copilot']);
  });

  it('skips a name that already has a page, under its title or another name', () => {
    expect(pagesFrom(copilot, ['github-copilot.md'], new Set(), 's').files).toEqual([]);
    expect(pagesFrom(copilot, [], new Set(['copilot']), 's').files).toEqual([]);
  });

  it('says why it left out an unknown kind or a page that is too long', () => {
    const odd = page('why: A post names it in passing.\ntitle: Something\nkind: concept');
    const long = page('why: A post leans on this book.\ntitle: A Book\nkind: book', 300);
    const { files, skipped } = pagesFrom(`${odd}\n\n${long}`, [], new Set(), 's');
    expect(files).toEqual([]);
    expect(skipped).toHaveLength(2);
  });

  it('leaves out a page the site would refuse, so the build never breaks on an unreviewed page', () => {
    const numbered = page(
      'why: The post leans on this tool.\ntitle: Number Alias\nkind: tool\naliases: [123]',
    );
    const blank = page(
      'why: The post leans on this tool.\ntitle: Blank Alias\nkind: tool\naliases: [""]',
    );
    const long = page(`why: The post leans on this book.\ntitle: ${'A'.repeat(121)}\nkind: book`);
    const short = page('why: Too short.\ntitle: Short Why\nkind: book');
    const { files, skipped } = pagesFrom(
      [numbered, blank, long, short].join('\n\n'),
      [],
      new Set(),
      's',
    );
    expect(files).toEqual([]);
    expect(skipped).toHaveLength(4);
    expect(skipped[0]).toContain('aliases');
  });

  it('adds an empty list of other names when the model left it out', () => {
    const bare = page('why: The post tells his story.\ntitle: Ray Kurzweil\nkind: person');
    const { data } = matter(pagesFrom(bare, [], new Set(), 's').files[0]?.content ?? '');
    expect(data['aliases']).toEqual([]);
  });
});
