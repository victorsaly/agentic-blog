---
why: >
  The graph is the part of the blog the first post calls "unlike anything else", and it is the only feature
  promised there with no plan behind it. This file says what the first version is, in small slices, and how
  each slice is judged done, so any agent or session can pick up the next one cold.
---

# The graph: what's next

Read `CLAUDE.md` first, then `site/PRODUCT.md`. The idea is in the first post
(`thoughts/2026-10-23-talked-out-loud-tidied-by-ai/versions/long.md`, "A graph you can walk"): me in the
middle, topics around me, small ideas on the outside, one idea able to hang off two topics, nothing placed
by hand. Start at me and walk outwards, or start at one idea and see what it connects to.

## Where it stands (25 October 2026)

- **Not started.** Nothing on the site draws a graph. `site/src/pages/index.astro` says "the graph takes
  over in phase 3"; `site/PRODUCT.md` says "a later phase". This file is that phase.
- **The data already exists.** Every `structure.md` ends with a `## Small ideas` table: one row per idea,
  its topics in the second column. The structure agent writes it (`agents/structure/PROMPT.md`). Two posts
  today, 27 ideas, five topics.
- Topics come from `settings.yml → themes`. Reader copy says **Topics**; the field and `lib/themes.ts` keep
  the old name on purpose.

## Decisions for Victor before Slice G2

1. **The name and address.** Recommended: **Map**, at `/map`. The first post says "a map, not a list";
   "graph" reads as a chart. The alternative is "Graph", at `/graph`.
2. **Where the ideas live.** Recommended: keep the table and parse it, failing the build on a malformed
   row. No agent change, and both posts work as they are. The alternative is moving the ideas into front
   matter (`ideas: [{ text, themes }]`), which is sturdier but changes the structure agent, its card, its
   tests and both posts.
3. **When it becomes the front door.** Recommended: not in this plan. Live with `/map` first; Slice G3 is
   the switch, and it is a separate decision.

## The slices

One slice per pull request, in this order. A slice is not done until CI is green and Victor merges it.

### Slice G1: the graph as data (no UI)

- `site/src/lib/graph.ts`: a pure function from the thoughts (front matter plus body) to
  `{ core, topics, ideas, edges }`. Each idea has its text, its post's slug and title, and its topics. Each
  edge joins an idea to a topic; topics join the core.
- Parsing the `## Small ideas` table is the only Markdown it reads. A row with no topic, or a topic not in
  `settings.yml`, throws with the file and the row, so the build fails rather than the page.
- Drafts are left out. An idea is never merged with a similar idea from another post (that is a later
  question, and a judgement, so it would be an agent's job with Victor's review).
- `graph.test.ts`: both real posts parse; an unknown topic fails with a plain message; a draft is absent;
  an idea on two topics has two edges.
- Done: `npm run test` covers it; nothing on the site changes.
- Good for: Copilot or Sonnet.

### Slice G2: the `/map` page

- Built at build time as one inline SVG. No client JavaScript, no force simulation, no new dependency.
- Layout is computed, never placed by hand: me at the centre; topics evenly on a ring, most written about
  at the top; each idea on an outer ring at the mean angle of its topics, so an idea on two topics sits
  between them. Ideas of one post stay next to each other. Same input, same picture.
- Ink only: hairline edges, filled dots for ideas, topic names in the strong weight. Marigold marks one
  thing: the topic you opened (`/map#credibility` uses `:target` to darken its edges and ideas and dim the
  rest). No motion.
- Every node is a link: the core to `/how-it-works`, a topic to `/topics/<topic>`, an idea to its post.
- The readable layer sits under the picture and is the same data as a list: each topic, its ideas, each
  idea linking to its post. This is what a screen reader and the keyboard use; the SVG gets `role="img"`
  and a one-line `aria-label`, and its links are left out of the tab order so nothing is reached twice.
- Phones first: under about 600px the SVG shows the core and the topic ring only, with a count on each
  topic, and the list does the rest. Ideas' text never appears inside the SVG at any width; it goes in the
  list.
- A link to the map in the header next to Topics, and from `/topics`.
- Before starting: Impeccable and `emil-design-eng`. Before merge: `/impeccable critique` and axe.
- Done: the page builds from the two posts with no hand-placed coordinates; a new topic in a post appears
  on the ring after a build with no code change; keyboard and screen reader reach every idea through the
  list; axe is clean in light and dark; the layout test checks that an idea on two topics sits between them.
- Good for: Opus or Fable.

### Slice G3: the front door (needs Victor's decision first)

- The home page's lead becomes the map; the newest post and the index move below it. The portrait, the
  name and the one line stay first.
- Done: Victor has lived with `/map` and said yes; the home page still works at phone width with the map
  in place; the critique score does not drop.

### Later (each needs its own plan before work starts)

- **The graph around a post.** On The road tab, this post's ideas and the other posts that share a topic.
- **Ideas that recur.** When two posts say the same small idea, one node with two posts. A judgement, so
  an agent proposes it and Victor merges it.
- **Change over time.** A date slider, or a ring per year, so a new topic appears and the old ones stay
  where they were.

## Rules for any agent picking up a slice

- Branch from `main`, named `feat/graph-<slice>`. Conventional Commits. One slice per pull request.
- TypeScript strict, no `any`, no non-null assertions, `unknown` narrowed with zod at the boundary. Named
  exports. Tests next to the code. Colours only from `site/src/styles/tokens.css`.
- Never edit anything under `thoughts/*/origin/`. Every new Markdown file starts with a `why:`.
- Before asking for review: `npm run lint && npm run typecheck && npm run test && npm run check:why`.
- Agents open pull requests; a person merges. Never merge your own.
