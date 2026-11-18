---
why: >-
  The short version, read aloud in one voice, with the time of every word, so a
  reader who would rather listen can, and the page can follow along. The text
  below is exactly what is spoken.
generated_by: voice
read_from: versions/short.md
language: en
audio: short.mp3
timings: short.json
voice: Victor Saly
voice_id: eHHUhFBxuo0yMYCOGHks
model: eleven_v3
speed: 1.1
text_sha256: 9f8d2c5f3d648bde9f72f1b35ca5717e1cb0682ce15f41547261740ba0c15ad8
words: 198
seconds: 66.618
made: '2026-11-18'
reviewed: false
---

I like to build tools for my own projects. Most of them stay small. Me and a few close colleagues use them, and that is all.

In 2020 I wrote dbschema-markdown. A small command-line tool: it read a SQL Server database and wrote the schema as Markdown. I hooked it to a blog, so I could search the schema of several project databases in one place.

It worked, for us. It never went further.

This month it did. dbtour is the same idea, opened up for anyone. It documents a database from its catalogue and keeps the docs in your repository: Markdown with diagrams, one page you can search, and an MCP server so an agent writes SQL from the real names. If you want it to read the data too, it does that read-only.

Where did AI-assisted development help most? A second database, SQLite, the one I use the least. And the plugs into other tools: the MCP server, the Claude Code plugin, the skill.

What AI did not do is decide. It took several iterations, a lot of preparation, testing and verification. And using it every day.

It worked for me. Now it works for you.
