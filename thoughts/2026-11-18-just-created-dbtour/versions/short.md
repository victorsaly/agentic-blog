---
why: Written in a Claude Code session from Victor's written origin and answers, not by the convert agent. I kept the line from internal tool to product and his two answers about where AI helped and where he decided. The dates and features come from the repositories, not from Victor's words.
kind: short
language: en
converted_from: ../origin/text.md
converted_by: claude-code
reviewed: false
---

I like to build tools for my own work. Most of them stay there. Me and my team use them, and that is all.

In 2020 I wrote dbschema-markdown. A small command-line tool: it read a SQL Server database and wrote the schema as Markdown. We hooked it to an internal blog, so we could search the schema of several project databases in one place.

It worked, for us. It never went further.

This month it did. dbtour is the same idea, opened up for anyone. It reads the catalogue of a database, never the rows. It keeps the docs in your repository: Markdown with diagrams, one page you can search, and an MCP server so an agent writes SQL from the real names.

Where did AI-assisted development help most? A second database, SQLite, the one I use the least. And the plugs into other tools: the MCP server, the Claude Code plugin, the skill.

What AI did not do is decide. It took several iterations, a lot of preparation, testing and verification. And using it every day.

A good internal idea doesn't have to stay internal.
