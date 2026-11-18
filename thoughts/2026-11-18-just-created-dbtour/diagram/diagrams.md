---
why: >
  Victor asked for infographics about database management. Written in a Claude Code session, not by the
  diagram agent, in the agent's shapes so the site draws them in its own type. Three sections describe a
  shape: "What changed" is the order dbtour works in, "Where I decided" holds 2020 against today, and
  "What it is now" holds what dbtour always reads against what it reads only when asked. Every label comes
  from the long version.
generated_by: claude-code
reviewed: true
diagrams:
  - section: "What changed"
    kind: flow
    title: "From a database to docs people and agents use"
    caption: "One model file in the middle; everything else is drawn from it."
    steps:
      - label: "Read the catalogue"
        detail: "Tables, columns, keys, relations, indexes."
      - label: "Write one model file"
        detail: "It lives in your repository, beside your code."
      - label: "Render Markdown with diagrams"
        detail: "GitHub shows it as it is."
      - label: "Render one page"
        detail: "Search it, follow relations, open the map."
      - label: "Hand it to an agent"
        detail: "Over MCP, so it writes SQL from the real names."
  - section: "Where I decided"
    kind: compare
    title: "The same idea, six years apart"
    caption: "The good idea was already there in 2020; what changed is who can use it."
    before:
      label: "2020: dbschema-markdown"
      items:
        - "SQL Server"
        - "The schema as Markdown, into one blog"
        - "One search box over every project"
        - "Me and a few close colleagues"
    after:
      label: "2026: dbtour"
      items:
        - "SQL Server, Azure SQL and SQLite"
        - "Markdown with diagrams, and one page"
        - "An MCP server and a plugin for agents"
        - "Anyone, from npm and GitHub"
  - section: "What it is now"
    kind: compare
    title: "What dbtour reads, and what it leaves alone"
    caption: "Documenting needs only the catalogue; the data is your choice."
    before:
      label: "Always: the catalogue"
      items:
        - "Tables, columns and keys"
        - "Relations and indexes"
        - "Rows and size, as the database counts them"
    after:
      label: "Only if you ask: the data"
      items:
        - "Through a read-only login you give it"
        - "A SELECT in a transaction, always rolled back"
        - "A SQLite file opened read-only"
        - "Passwords in the keychain, never a file"
---

- What changed: From a database to docs people and agents use (flow)
- Where I decided: The same idea, six years apart (compare)
- What it is now: What dbtour reads, and what it leaves alone (compare)
