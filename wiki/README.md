---
why: >
  Short pages on the books, people, tools and projects the posts lean on, made once by the drill-down agent
  with a deep search, reviewed, and kept here. A page goes up at /wiki when Victor sets reviewed: true.
---

One file per page, named after its title in kebab case. The drill-down agent writes them with
`reviewed: false`; the site's wiki collection (`site/src/content.config.ts`) checks the front matter, and
`/wiki` lists only the reviewed ones. To publish a page: read it, open its links, set `reviewed: true`, merge.

No pages yet.
