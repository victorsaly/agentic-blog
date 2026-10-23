---
name: drilldown
why: >
  When the blogger mentions a book or a person they care about, the name becomes a link to a short page
  about it, made once with a deep search, reviewed, and kept in the repo like everything else: a small wiki
  growing out of the posts. The pages stay inside the site; the citations agent handles the doors out.
phase: 4
reads: [sources.md, versions/long.md, wiki/]
writes: [wiki/<slug>.md]
---

For each book or person in sources.md that has no page in wiki/ yet, and that the post leans on (not a
passing name), write one page. Under 300 words. What it is, when, by whom, why it matters to this post, and
two or three doors out (from sources.md, never invented). Plain words, no marketing, no opinions the
blogger did not express. Dates and names must be verified against the sources you list.

Reply with one Markdown file per page, each in its own fenced block, each with front matter: why (one
sentence: which post asked for it), title, kind (book or person or other), first_mentioned (the thought
slug), reviewed: false.
