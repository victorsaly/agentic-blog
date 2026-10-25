// Why: the graph is drawn from what the structure agent already writes, the "Small ideas" table at the end
// of every structure.md, so nothing is placed by hand and a new topic is one new tag. This turns the posts
// into nodes and edges, and fails the build on a row it cannot read, so a broken table never draws wrong.

/** What the graph needs from one post: its front matter and the Markdown body. */
export interface GraphPost {
  slug: string;
  title: string;
  draft: boolean;
  body: string;
}

export interface GraphTopic {
  id: string;
  topic: string;
  /** How many small ideas hang off this topic, across every post. */
  ideas: number;
}

export interface GraphIdea {
  id: string;
  text: string;
  topics: string[];
  slug: string;
  title: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface Graph {
  core: { id: 'core' };
  topics: GraphTopic[];
  ideas: GraphIdea[];
  edges: GraphEdge[];
}

interface Row {
  text: string;
  topics: string[];
}

const heading = /^##\s+Small ideas\s*$/i;
const unescapedPipe = /(?<!\\)\|/;
const delimiter = /^:?-+:?$/;

/** The cells of one table row, outer pipes optional, with escaped pipes kept as text. */
function cellsOf(line: string): string[] {
  const inner = line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '');
  return inner.split(unescapedPipe).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/**
 * The rows of a post's "## Small ideas" table: exactly two columns, idea and topics (the structure agent's
 * contract). A post without the section has no small ideas. A header or separator that is not two columns,
 * a row with more or fewer cells, no idea, no topic, or a topic not in `known` throws naming the file and
 * the row, so no row is ever dropped quietly.
 */
export function smallIdeasOf(body: string, known: readonly string[], file: string): Row[] {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => heading.test(line.trim()));
  if (start === -1) return [];

  // Every line under the heading with a pipe in it is a table row, with or without outer pipes.
  const section: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    if (unescapedPipe.test(line)) section.push(line);
  }

  // The first row is the header and the second the separator; neither is an idea.
  const [header, rule, ...bodyRows] = section;
  if (header === undefined) return [];
  if (cellsOf(header).length !== 2) {
    throw new Error(`${file}: the Small ideas table needs two columns, Idea and Themes`);
  }
  const ruleCells = rule === undefined ? [] : cellsOf(rule);
  if (ruleCells.length !== 2 || !ruleCells.every((cell) => delimiter.test(cell))) {
    throw new Error(
      `${file}: the Small ideas table has no two-column separator row under its header`,
    );
  }

  return bodyRows.map((line, index) => {
    const where = `${file}, small idea ${String(index + 1)}`;
    const cells = cellsOf(line);
    if (cells.length !== 2) {
      throw new Error(
        `${where}: the row has ${String(cells.length)} cells, not 2 (escape a pipe in an idea as \\|)`,
      );
    }
    const [text = '', topicCell = ''] = cells;
    if (text.length === 0) throw new Error(`${where}: the row has no idea in its first column`);
    const topics = [
      ...new Set(
        topicCell
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      ),
    ];
    if (topics.length === 0) throw new Error(`${where}: "${text}" has no topic`);
    for (const topic of topics) {
      if (!known.includes(topic)) {
        throw new Error(
          `${where}: "${topic}" is not a topic in settings.yml (known: ${known.join(', ')})`,
        );
      }
    }
    return { text, topics };
  });
}

/**
 * The whole graph: the core, every topic at least one idea hangs off (most ideas first, then by name), every
 * idea of every published post, an edge from the core to each topic and from each idea to each of its topics.
 * Posts are taken in slug order, so the same posts always give the same graph.
 */
export function graphOf(posts: readonly GraphPost[], known: readonly string[]): Graph {
  const published = posts.filter((p) => !p.draft).sort((a, b) => a.slug.localeCompare(b.slug));

  const ideas: GraphIdea[] = published.flatMap((post) =>
    smallIdeasOf(post.body, known, `thoughts/${post.slug}/structure.md`).map((row, index) => ({
      id: `idea:${post.slug}:${String(index + 1)}`,
      text: row.text,
      topics: row.topics,
      slug: post.slug,
      title: post.title,
    })),
  );

  const counts = new Map<string, number>();
  for (const idea of ideas) for (const t of idea.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
  const topics: GraphTopic[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([topic, n]) => ({ id: `topic:${topic}`, topic, ideas: n }));

  const edges: GraphEdge[] = [
    ...topics.map((t) => ({ from: 'core', to: t.id })),
    ...ideas.flatMap((idea) => idea.topics.map((t) => ({ from: idea.id, to: `topic:${t}` }))),
  ];

  return { core: { id: 'core' }, topics, ideas, edges };
}
