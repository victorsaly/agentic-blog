// Why: the chat answers from what the site publishes, so at build time this writes it out as one file the
// Worker reads. For every post that is not a draft: message, idea, the long version, the raw origin, its
// topics and small ideas, its sources once reviewed (what each claim rests on and what is there), what the
// interview agent asked and any answers, and how it was made from the ledger (which agents, what it cost).
// Then the site's own pages: how it works, the topics, and the wiki. It is the same text the site already
// shows; nothing private goes in. Each post lists its places, so an answer can send the reader to the exact
// spot. It also carries the one switch: the chat opens to everyone only when settings.yml publishing.index is on.
import type { APIRoute } from 'astro';
import { getCollection, render } from 'astro:content';
import { join } from 'node:path';
import { parse } from 'yaml';
import { readRuns } from '@roadbook/core/node';
import { firstSentence, phases, rosterFrom, type AgentCardFacts } from '../lib/agents';
import type { Corpus, CorpusPage, CorpusPost, Place } from '../lib/ask';
import { leafOf, thoughtSlugOf } from '../lib/content';
import { smallIdeasOf } from '../lib/graph';
import { howMade, moneyOf } from '../lib/how-made';
import { settings } from '../lib/settings';
import { parseSources } from '../lib/sources';
import { topicAbout, topicName } from '../lib/topic-name';

// Typed at the boundary: on a fresh checkout Astro has not generated its content types yet when lint runs.
interface Entry {
  id: string;
  body?: string;
}
interface ThoughtEntry extends Entry {
  data: { title: string; message: string; draft: boolean; themes: string[] };
}
interface SourcesEntry extends Entry {
  data: { reviewed: boolean };
}
interface Heading {
  depth: number;
  slug: string;
  text: string;
}

// Typed here for the same reason: without generated types, render() is untyped when lint runs.
const renderEntry = render as unknown as (entry: Entry) => Promise<{ headings: Heading[] }>;

const headingsOf = async (entry: Entry | undefined, depth: number): Promise<Heading[]> =>
  entry ? (await renderEntry(entry)).headings.filter((h) => h.depth === depth) : [];

const repo = 'https://github.com/victorsaly/agentic-blog';

// The interview questions and the wiki have no content collection; they are read as the agents' prompts are.
const interviews = import.meta.glob<string>('../../../thoughts/*/interview.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const wikiPages = import.meta.glob<string>('../../../wiki/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const agentCards = import.meta.glob<AgentCardFacts>('../../../agents/*/card.ts', {
  import: 'card',
  eager: true,
});
const agentPrompts = import.meta.glob<string>('../../../agents/*/PROMPT.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const split = (raw: string): { front: Record<string, unknown>; body: string } => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  const front: unknown = m ? parse(m[1] ?? '') : {};
  return {
    front: typeof front === 'object' && front !== null ? (front as Record<string, unknown>) : {},
    body: (m?.[2] ?? raw).trim(),
  };
};

/** What the sources table says, in lines a reader (and the chat) can follow: the claim, its doors, what is there. */
function sourcesText(markdown: string): string {
  const list = parseSources(markdown);
  const lines = list.claims.map(
    (c) =>
      `- ${c.mention} → ${c.doors
        .map((d) => `${d.label}${d.note ? ` ${d.note}` : ''}: ${d.url}`)
        .join('; ')}${c.about ? `. What is there: ${c.about}` : ''}`,
  );
  if (list.unsourced.length > 0)
    lines.push('No source found, or not searched:', ...list.unsourced.map((u) => `- ${u}`));
  return lines.join('\n');
}

/** How the post was made, from its ledger, in one plain paragraph; undefined when nothing is recorded. */
async function madeText(slug: string): Promise<string | undefined> {
  const ledger = await readRuns(join(process.cwd(), '..', 'thoughts', slug), `thoughts/${slug}`);
  if (ledger.issues.length > 0) throw new Error(ledger.issues.join('\n'));
  const made = howMade(ledger.runs);
  if (!made) return undefined;
  const currency = {
    show: settings.publishing.currency.show,
    perUsd: settings.publishing.currency.per_usd,
  };
  const steps = made.steps
    .map(
      (s) =>
        `${s.agent} (${String(s.runs)} run${s.runs === 1 ? '' : 's'}, last ${s.ended} on ${s.on.slice(0, 10)})`,
    )
    .join('; ');
  return [
    `Agents that worked on it: ${steps}.`,
    `Recorded cost of every run: ${made.totalIsFloor ? 'at least ' : ''}${moneyOf(made.totalUsd, currency)}, since ${made.since.slice(0, 10)}.`,
    made.byPerson.length > 0
      ? `Written by a person, not an agent: ${made.byPerson.join(', ')}.`
      : '',
    made.editedByPerson.length > 0
      ? `Edited by a person after the agent: ${made.editedByPerson.join(', ')}.`
      : '',
    made.overrides.length > 0
      ? `Overridden: ${made.overrides.map((o) => `${o.node} by ${o.by} (${o.reason})`).join('; ')}.`
      : '',
  ]
    .filter((line) => line !== '')
    .join(' ');
}

/** The site's own pages: how it works (from the agents' own cards), the topics, and every wiki page. */
function sitePages(): CorpusPage[] {
  const roster = rosterFrom(Object.values(agentCards), Object.values(agentPrompts));
  const agents = roster
    .map(
      (a) =>
        `- ${a.name} (phase ${String(a.phase)}, ${phases[a.phase] ?? ''}): ${firstSentence(a.why)}${a.canHold ? ' Can stop a post.' : ''} Reads ${a.reads.join(', ')}; writes ${a.writes.join(', ')}.`,
    )
    .join('\n');
  const howItWorks = [
    `Every post starts as a raw voice or text note, the origin, kept exactly as it came out and never edited. A team of ${String(roster.length)} AI agents, one job each, tidies it into a post that keeps the blogger's words, shows what changed and why, and names its sources. Every agent reads the blogger's profile first and writes its why at the top of everything it makes.`,
    "Every step is a pull request on GitHub, and each agent is called by a label on it. Two agents, safety and security, can only say no: either can stop a post, and writes down why. When an agent needs the blogger to answer a question, the question opens in the thought's record and waits in the studio as Needs you; only a person can close it. Nothing goes live until the blogger merges.",
    "Every run is written to the thought's ledger: which agent, how it ended, what it wrote and what it cost, each entry chained to the one before; a check on every pull request refuses one that changes or removes a run already merged. Every call to a paid model is priced before it is made, a model with no known price is refused, each agent has a budget per run, and the studio shows the month's spend against the budget. Posts are read aloud in the blogger's own voice by the voice agent, word for word, and the word being said is underlined on the page.",
    `The agents:\n${agents}`,
  ].join('\n\n');

  const topics = settings.themes
    .map((t) => `- ${topicName(t)}: ${topicAbout(t) ?? ''}`.trimEnd())
    .join('\n');

  const wiki = Object.entries(wikiPages).flatMap(([path, raw]): CorpusPage[] => {
    const file = path.split('/').at(-1) ?? '';
    if (file === 'README.md') return [];
    const { front, body } = split(raw);
    const name = file.replace(/\.md$/, '');
    const title = typeof front.title === 'string' ? front.title : name;
    // The wiki has no page on the site yet; until it does, the door out is the file itself.
    return [{ href: `${repo}/blob/main/wiki/${file}`, title: `Wiki: ${title}`, text: body }];
  });

  return [
    { href: '/how-it-works', title: 'How it works', text: howItWorks, always: true },
    {
      href: '/topics',
      title: 'Topics',
      text: `The topics the thoughts are about, each with one line on what it covers:\n${topics}\nEvery topic and every small idea in them is drawn as one graph at /graph: the blogger in the middle, the topics around, the small ideas on the outside, each idea linked to the paragraph of its post that says it.`,
      always: true,
    },
    ...wiki,
  ];
}

export const GET: APIRoute = async () => {
  const thoughts = ((await getCollection('thoughts')) as unknown as ThoughtEntry[]).filter(
    (t) => !t.data.draft,
  );
  const versions = (await getCollection('versions')) as unknown as Entry[];
  const origins = (await getCollection('origins')) as unknown as Entry[];
  const sources = (await getCollection('sources')) as unknown as SourcesEntry[];
  const posts: CorpusPost[] = await Promise.all(
    thoughts.map(async (t) => {
      const slug = thoughtSlugOf(t.id);
      const entry = (leaf: string) =>
        versions.find((v) => thoughtSlugOf(v.id) === slug && leafOf(v.id) === leaf);
      const own = origins.filter((o) => thoughtSlugOf(o.id) === slug && leafOf(o.id) !== 'answers');
      const answers = origins.find(
        (o) => thoughtSlugOf(o.id) === slug && leafOf(o.id) === 'answers',
      );
      const short = entry('short')?.body?.trim() ?? '';
      const road = entry('long')?.body?.trim() ?? '';
      const base = `/thoughts/${slug}`;
      const roadSections = await headingsOf(entry('long'), 2);
      const notes = (await Promise.all(own.map((o) => headingsOf(o, 1)))).flat();

      // Sources go in once reviewed, as they show on the page (and always in local development).
      const sourcesEntry = sources.find((s) => thoughtSlugOf(s.id) === slug);
      const showSources =
        sourcesEntry !== undefined && (sourcesEntry.data.reviewed || import.meta.env.DEV);
      const sourcesList = showSources ? sourcesText(sourcesEntry.body ?? '') : '';

      const interviewRaw = interviews[`../../../thoughts/${slug}/interview.md`];
      let interview = '';
      if (interviewRaw) {
        const { front, body } = split(interviewRaw);
        const answered = front.answered === true;
        interview = `Questions the interview agent asked (${answered ? 'answered' : 'not answered yet'}):\n${body}`;
        const said = answers?.body?.trim();
        if (said) interview += `\n\nThe blogger's answers, in their own words:\n${said}`;
      }

      const made = await madeText(slug);
      const ideas = smallIdeasOf(
        t.body ?? '',
        settings.themes,
        `thoughts/${slug}/structure.md`,
      ).map((row) => ({ text: row.text, topics: row.topics.map((topic) => topicName(topic)) }));

      let n = 0;
      const places: Place[] = [
        { href: `${base}#idea`, name: 'The idea, on one screen' },
        ...(road ? [{ href: `${base}#road`, name: 'The road, the whole piece' }] : []),
        // Numbered as the page numbers them: the notes on what changed stand outside the count.
        ...roadSections.map((h) => {
          const counted = !/^what changed/i.test(h.text);
          if (counted) n += 1;
          return {
            href: `${base}#${h.slug}`,
            name: counted ? `The road, section ${String(n)}: ${h.text}` : `The road: ${h.text}`,
          };
        }),
        ...(sourcesList
          ? [{ href: `${base}#sources`, name: 'The sources, a door out of every claim' }]
          : []),
        ...(made ? [{ href: `${base}#how-made`, name: 'How this was made' }] : []),
        ...notes.map((h) => ({
          href: `${base}/origin#${h.slug}`,
          name: `The origin, ${h.text.replace(/^origin\s+(\d+)\s*[—–-]\s*/i, 'note $1: ')}`,
        })),
      ];
      return {
        slug,
        title: t.data.title,
        message: t.data.message,
        idea: short || (t.body?.trim() ?? ''),
        road,
        origin: own.map((o) => o.body?.trim() ?? '').join('\n\n'),
        places,
        topics: t.data.themes.map((topic) => topicName(topic)),
        ideas,
        ...(sourcesList ? { sources: sourcesList } : {}),
        ...(interview ? { interview } : {}),
        ...(made ? { made } : {}),
      };
    }),
  );
  const corpus: Corpus = {
    open: settings.publishing.index,
    model: settings.agents.model,
    site: settings.site.domain,
    author: settings.site.author,
    posts,
    pages: sitePages(),
  };
  return new Response(JSON.stringify(corpus), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
