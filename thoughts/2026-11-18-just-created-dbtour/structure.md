---
why: >
  Written in a Claude Code session with Victor instead of by the structure agent, from his written origin and his answers. The facts about dbschema-markdown and dbtour (dates, versions, databases, the MCP server and plugin) come from the two GitHub repositories and npm, checked on 2026-11-18. Victor asked for a shorter message than the one offered, and for the story to be about his own projects and a few close colleagues.
title: It worked for me. Now it works for you.
date: 2026-11-18
language: en
themes:
  - ai-changing-work
  - apps-and-workflows
  - credibility
message: >
  My side projects usually stay small: me and a few close colleagues. dbtour
  started that way, in 2020. AI-assisted development is how it became a product
  anyone can use.
origins:
  - origin/text.md
  - origin/answers.md
number: 5
draft: false
---

## The idea

I like to build tools for my own projects. Most of them stay small: used by me and a few close colleagues, and that is all.

In 2020 I wrote dbschema-markdown. It was a small command-line tool. It read a SQL Server database and wrote its schema as Markdown. I hooked it to a blog, so the schema of several project databases could be searched in one place.

It worked, for us. It never went further.

[dbtour](https://skills.victorsaly.com/dbtour) is that same idea, opened up for anyone. It documents a database from its catalogue and keeps the docs in your repository: Markdown with diagrams, one searchable page, and an MCP server so an agent can write SQL from the real names. If you want it to read the data too, it does that read-only, and only with a login you give it.

Where did AI help most? A second database, SQLite, that I use the least. And the plugs into other tools: the MCP server, the Claude Code plugin, the skill.

What AI did not do is decide. It took several iterations, a lot of preparation, testing and verification, and using it every day.

It worked for me. Now it works for you.

## The road

The full version, from dbschema-markdown to dbtour, is in [versions/long.md](versions/long.md).

## Small ideas

| Idea | Themes |
|---|---|
| My side projects usually stay small: me and a few close colleagues. | apps-and-workflows |
| dbtour started in 2020 as dbschema-markdown, a small CLI hooked to a blog. | apps-and-workflows |
| AI helped most with the database I use the least, and the plugs into other tools. | ai-changing-work |
| AI did not decide. Iterations, testing, verification and daily use did. | credibility, ai-changing-work |
| The structure comes from the catalogue; the data only read-only, and only if you ask. | apps-and-workflows |
| It worked for me. Now it works for you. | ai-changing-work |
