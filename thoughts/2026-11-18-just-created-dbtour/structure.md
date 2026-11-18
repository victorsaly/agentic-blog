---
why: >
  Written in a Claude Code session with Victor instead of by the structure agent, from his written origin and his answers. The facts about dbschema-markdown and dbtour (dates, versions, databases, the MCP server and plugin) come from the two GitHub repositories and npm, checked on 2026-11-18. Victor asked for a shorter message than the one offered, so it is two short lines.
title: Good ideas don't have to stay internal
date: 2026-11-18
language: en
themes:
  - ai-changing-work
  - apps-and-workflows
  - credibility
message: >
  My tools usually stay with me and my team. dbtour started that way, in 2020.
  AI-assisted development is how it became a product anyone can use.
origins:
  - origin/text.md
  - origin/answers.md
number: 5
draft: false
---

## The idea

I like to build tools for my own work. Most of them stay there: used by me and my team, and that is all.

In 2020 I wrote dbschema-markdown. It was a small command-line tool. It read a SQL Server database and wrote its schema as Markdown. We hooked it to an internal blog, so we could search the schema of several project databases in one place.

It worked, for us. It never went further.

dbtour is that same idea, opened up. It reads the catalogue of a database, never the rows, and keeps the docs in your repository: Markdown with diagrams, one searchable page, and an MCP server so an agent can write SQL from the real names.

Where did AI help most? A second database, SQLite, that I use the least. And the plugs into other tools: the MCP server, the Claude Code plugin, the skill.

What AI did not do is decide. It took several iterations, a lot of preparation, testing and verification, and using it every day.

A good internal idea doesn't have to stay internal.

## The road

The full version, from dbschema-markdown to dbtour, is in [versions/long.md](versions/long.md).

## Small ideas

| Idea | Themes |
|---|---|
| My tools usually stay with me and my team. | apps-and-workflows |
| dbtour started in 2020 as dbschema-markdown, a small CLI hooked to an internal blog. | apps-and-workflows |
| AI helped most with the database I use the least, and the plugs into other tools. | ai-changing-work |
| AI did not decide. Iterations, testing, verification and daily use did. | credibility, ai-changing-work |
| Read the catalogue, never the rows. | apps-and-workflows |
| A good internal idea doesn't have to stay internal. | ai-changing-work |
