// Why: the graph is drawn from these nodes and edges with nothing placed by hand, so a misread table would
// put an idea under the wrong topic on the page. The real posts are read here too, so a table the structure
// agent writes in a new shape fails a test before it fails a build.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { graphOf, smallIdeasOf, type GraphPost } from './graph.js';

const known = ['ai-changing-work', 'accountability', 'credibility', 'scalable-secure'];

const table = (rows: string) =>
  `## The idea\n\nText.\n\n## Small ideas\n\n| Idea | Themes |\n| --- | --- |\n${rows}\n`;

const post = (slug: string, rows: string, draft = false): GraphPost => ({
  slug,
  title: `Title of ${slug}`,
  draft,
  body: table(rows),
});

describe('smallIdeasOf', () => {
  it('reads each row with its topics', () => {
    expect(
      smallIdeasOf(table('| Keep the raw note | ai-changing-work, credibility |'), known, 'f'),
    ).toEqual([{ text: 'Keep the raw note', topics: ['ai-changing-work', 'credibility'] }]);
  });

  it('keeps an escaped pipe as part of the idea', () => {
    const [row] = smallIdeasOf(table('| This \\| that | credibility |'), known, 'f');
    expect(row?.text).toBe('This | that');
  });

  it('stops at the next heading', () => {
    const body = `${table('| One | credibility |')}\n## Notes\n\n| Not | an idea |\n`;
    expect(smallIdeasOf(body, known, 'f')).toHaveLength(1);
  });

  it('stops at the end of the table: a later table or a line with a pipe is not an idea', () => {
    const body = `${table('| One | credibility |')}\n### Notes\n\n| a | b |\n| --- | --- |\n| x | y |\n`;
    expect(smallIdeasOf(body, known, 'f')).toHaveLength(1);
    const after = `${table('| One | credibility |')}\nThis or that | either way.\n`;
    expect(smallIdeasOf(after, known, 'f')).toHaveLength(1);
  });

  it('skips a sentence with a pipe above the table', () => {
    const body = `## Small ideas\n\nThis | that, said plainly.\n\n| Idea | Themes |\n| --- | --- |\n| One | credibility |\n`;
    expect(smallIdeasOf(body, known, 'f').map((r) => r.text)).toEqual(['One']);
  });

  it('gives nothing for a post without the section', () => {
    expect(smallIdeasOf('## The idea\n\nText.\n', known, 'f')).toEqual([]);
  });

  it('refuses a topic settings.yml does not know, naming the file and the row', () => {
    expect(() =>
      smallIdeasOf(
        table('| One | credibility |\n| Two | crediblity |'),
        known,
        'thoughts/x/structure.md',
      ),
    ).toThrow('thoughts/x/structure.md, small idea 2: "crediblity" is not a topic in settings.yml');
  });

  it('refuses a row with no topic', () => {
    expect(() => smallIdeasOf(table('| Lonely idea |  |'), known, 'f')).toThrow(
      '"Lonely idea" has no topic',
    );
  });

  it('reads rows without outer pipes, so a mixed table loses no row', () => {
    const rows = smallIdeasOf(table('| One | credibility |\nTwo | accountability'), known, 'f');
    expect(rows.map((r) => r.text)).toEqual(['One', 'Two']);
    expect(() =>
      smallIdeasOf(table('| One | credibility |\nTwo | crediblity'), known, 'f'),
    ).toThrow('small idea 2: "crediblity" is not a topic');
  });

  it('refuses a row with an extra column instead of dropping it', () => {
    expect(() => smallIdeasOf(table('| One | credibility | accountability |'), known, 'f')).toThrow(
      'small idea 1: the row has 3 cells, not 2',
    );
  });

  it('refuses a separator that is not two delimiter cells', () => {
    const tableWith = (rule: string) =>
      `## Small ideas\n\n| Idea | Themes |\n${rule}\n| One | credibility |\n`;
    for (const rule of ['| --- |', '| | |', '| One | credibility |']) {
      expect(() => smallIdeasOf(tableWith(rule), known, 'f')).toThrow('two-column separator');
    }
  });
});

describe('graphOf', () => {
  it('joins an idea on two topics to both, and every topic to the core', () => {
    const g = graphOf([post('2026-01-01-a', '| Both | credibility, accountability |')], known);
    expect(g.edges).toEqual([
      { from: 'core', to: 'topic:accountability' },
      { from: 'core', to: 'topic:credibility' },
      { from: 'idea:2026-01-01-a:1', to: 'topic:credibility' },
      { from: 'idea:2026-01-01-a:1', to: 'topic:accountability' },
    ]);
  });

  it('refuses a thought folder that is not plain lowercase words joined by hyphens', () => {
    expect(() => graphOf([post('2026-01-01-My_Post', '| One | credibility |')], known)).toThrow(
      'thoughts/2026-01-01-My_Post: a thought',
    );
  });

  it('leaves drafts out', () => {
    const g = graphOf([post('2026-01-01-a', '| Hidden | credibility |', true)], known);
    expect(g.ideas).toEqual([]);
    expect(g.topics).toEqual([]);
  });

  it('lists topics most used first, then by name, and only those an idea hangs off', () => {
    const g = graphOf(
      [
        post('2026-01-02-b', '| One | credibility |\n| Two | credibility, ai-changing-work |'),
        post('2026-01-01-a', '| Three | accountability |'),
      ],
      known,
    );
    expect(g.topics.map((t) => [t.topic, t.ideas])).toEqual([
      ['credibility', 2],
      ['accountability', 1],
      ['ai-changing-work', 1],
    ]);
    expect(g.ideas.map((i) => i.slug)).toEqual(['2026-01-01-a', '2026-01-02-b', '2026-01-02-b']);
  });
});

describe('the real posts', () => {
  const thoughts = fileURLToPath(new URL('../../../thoughts/', import.meta.url));
  const settings = parse(
    readFileSync(fileURLToPath(new URL('../../../settings.yml', import.meta.url)), 'utf8'),
  ) as { themes: string[] };
  // A new origin lands as a folder with only origin/ in it; structure.md comes later, from an agent.
  const posts: GraphPost[] = readdirSync(thoughts, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${thoughts}${d.name}/structure.md`))
    .map((d) => {
      const raw = readFileSync(`${thoughts}${d.name}/structure.md`, 'utf8');
      const [, front = '', body = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw) ?? [];
      const meta = parse(front) as { title: string; draft?: boolean };
      return { slug: d.name, title: meta.title, draft: meta.draft ?? false, body };
    });

  it('every post parses, and every published post has small ideas', () => {
    const g = graphOf(posts, settings.themes);
    for (const p of posts.filter((p) => !p.draft)) {
      expect(g.ideas.some((i) => i.slug === p.slug)).toBe(true);
    }
  });
});
