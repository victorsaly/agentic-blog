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

- **G1 and G2 are built and live** at `/graph` (#89, #91). Built on top of the plan, at Victor's ask:
  - Lines are bundled: ideas between two neighbouring topics run into one knot over the gap between arcs.
  - On a desk, resting on a dot sets the idea's words and its post in the middle and fades other posts.
  - Topics can carry a reader name (`settings.yml → topic_names`, `lib/topic-name.ts`, #90).
  - Each idea in the list links to the section of its post that says it (`lib/idea-sections.ts`, #93):
    matched by words and phrases; when no section is clearly ahead, the link goes to the start of the road.
    The expected section of every current idea is written out in its test.
  - No graph library: Sigma, Cytoscape and d3-force need script in the browser, draw on a canvas a screen
    reader cannot read, move, or give a different picture each run. The layout is our own, at build time.
- **G3 is open:** whether the graph becomes the home page, after Victor has lived with it.
- **The data.** Every `structure.md` ends with a `## Small ideas` table: one row per idea,
  its topics in the second column. The structure agent writes it (`agents/structure/PROMPT.md`). Two posts
  today, 27 ideas, five topics.
- Topics come from `settings.yml → themes`. Reader copy says **Topics**; the field and `lib/themes.ts` keep
  the old name on purpose.

## Decisions (Victor, 25 October 2026)

1. **The name and address: Graph, at `/graph`.** Not "Map".
2. **Where the ideas live: the table stays and is parsed**, failing the build on a malformed row. No agent
   change, and both posts work as they are. (Moving ideas into front matter was the alternative.)
3. **The front door: not in this plan.** Live with `/graph` first; Slice G3 is a separate decision.

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

### Slice G2: the `/graph` page

- Built at build time as one inline SVG. No client JavaScript, no force simulation, no new dependency.
- Layout is computed, never placed by hand: me at the centre; topics evenly on a ring, most written about
  at the top; each idea on an outer ring at the mean angle of its topics, so an idea on two topics sits
  between them. Ideas of one post stay next to each other. Same input, same picture.
- Ink only: hairline edges, filled dots for ideas, topic names in the strong weight. Marigold marks one
  thing: the topic you opened (`/graph#credibility` uses `:target` to darken its edges and ideas and dim the
  rest). No motion.
- Every node is a link: the core to `/how-it-works`, a topic to `/topics/<topic>`, an idea to its post.
- The readable layer sits under the picture and is the same data as a list: each topic, its ideas, each
  idea linking to its post. This is what a screen reader and the keyboard use; the SVG gets `role="img"`
  and a one-line `aria-label`, and its links are left out of the tab order so nothing is reached twice.
- Phones first: under about 600px the SVG shows the core and the topic ring only, with a count on each
  topic, and the list does the rest. Ideas' text never appears inside the SVG at any width; it goes in the
  list.
- A link to the graph in the header next to Topics, and from `/topics`.
- Before starting: Impeccable and `emil-design-eng`. Before merge: `/impeccable critique` and axe.
- Done: the page builds from the two posts with no hand-placed coordinates; a new topic in a post appears
  on the ring after a build with no code change; keyboard and screen reader reach every idea through the
  list; axe is clean in light and dark; the layout test checks that an idea on two topics sits between them.
- Good for: Opus or Fable.

### Slice G3: the front door (needs Victor's decision first)

- The home page's lead becomes the graph; the newest post and the index move below it. The portrait, the
  name and the one line stay first.
- Done: Victor has lived with `/graph` and said yes; the home page still works at phone width with the graph
  in place; the critique score does not drop.

### Later (each needs its own plan before work starts)

**When to start: at about five posts (60 to 70 ideas).** That is where the dots on a phone's ring begin to
touch (the desk holds about 100). Plan the two rings below then, before the picture gets crowded.

- **Two rings.** The newest posts' ideas on the outer ring, older ones on an inner ring, so the picture
  holds more and shows where the thinking has moved. The first one to build.
- **Idea links set by the agent.** The agent that writes the long version records which section holds
  each small idea, reviewed in its pull request, instead of the site working it out from the words.

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
