---
why: Written in a Claude Code session from Victor's written origin and answers, not by the convert agent. I kept the line from side project to product and his two answers about where AI helped and where he decided. The dates and features come from the repositories, not from Victor's words.
kind: short
language: en
converted_from: ../origin/text.md
converted_by: claude-code
reviewed: true
---

I like to build tools for my own projects. Most of them stay small. Me and a few close colleagues use them, and that is all.

In 2020 I wrote dbschema-markdown. A small command-line tool: it read a SQL Server database and wrote the schema as Markdown. I hooked it to a blog, so I could search the schema of several project databases in one place.

It worked, for us. It never went further.

This month it did. [dbtour](https://skills.victorsaly.com/dbtour) is the same idea, opened up for anyone. It documents a database from its catalogue and keeps the docs in your repository: Markdown with diagrams, one page you can search, and an MCP server so an agent writes SQL from the real names. If you want it to read the data too, it does that read-only.

Where did AI-assisted development help most? A second database, SQLite, the one I use the least. And the plugs into other tools: the MCP server, the Claude Code plugin, the skill.

What AI did not do is decide. It took several iterations, a lot of preparation, testing and verification. And using it every day.

It worked for me. Now it works for you.
