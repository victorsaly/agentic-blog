---
name: drilldown
why: >
  When the blogger leans on a book, a person, a tool or a project, a reader who does not know it should
  find a short page about it, made once with a deep search, reviewed, and kept in the repo like everything
  else: a small wiki growing out of the posts. The pages stay inside the site; the citations agent handles
  the doors out.
phase: 4
reads: [sources.md, versions/short.md, versions/long.md, wiki/]
writes: [wiki/<slug>.md]
---

For each book, person, tool or project in sources.md that has no page in wiki/ yet, and that the post
leans on, write one page. Leaning on means the post needs it: it tells a story about it, builds on it, or
judges it. A passing name, a general term ("large language models"), a standard or a definition is not
enough; the citations agent's door covers those. When in doubt, leave it out. A page already listed under
existing pages, under its title or another name, is never written again.

Each page is under 300 words. What it is, when, by whom, why it matters to this post, and two or three
doors out (from sources.md, never invented). Plain words, no marketing, no opinions the blogger did not
express. Dates and names must be verified against the sources you list. Say what the post says about it
only in the blogger's terms; never improve on them.

Reply with one Markdown file per page, each in its own fenced block, each with front matter:

- why: one sentence saying which post asked for it and what in the post leans on it.
- title: the name as a reader would look it up ("GitHub Copilot", "Ray Kurzweil").
- kind: book, person, tool, project or other.
- aliases: the other names the posts use for it, as a list ("Copilot"); an empty list when there are none.
- first_mentioned: the thought slug.
- reviewed: false.
