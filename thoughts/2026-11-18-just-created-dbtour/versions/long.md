---
why: Written in a Claude Code session from Victor's written origin and answers, not by the convert agent. Victor's words give the story and the two judgements (where AI helped, where he decided). Dates, version numbers, commit count and features come from the two GitHub repositories and npm, checked on 2026-11-18. Victor did not answer who dbtour is for, so that section says only what the README says it does.
kind: long
language: en
converted_from: ../origin/text.md
converted_by: claude-code
reviewed: false
---

# Good ideas don't have to stay internal

My tools usually stay with me and my team. dbtour started that way, in 2020. AI-assisted development is how it became a product anyone can use.

## Where it started

I like to build tools for my own work.

In January 2020 it was databases. We had several projects, each with its own SQL Server database. So I wrote [dbschema-markdown](https://github.com/victorsaly/dbschema-markdown): a command-line tool that read a database and wrote its schema as Markdown.

We hooked it to an internal blog. Every project's schema in one place, one search box over all of them.

## Where it stopped

It worked, for us. That is where my tools usually stop. Me and my team use them every day, and nobody else ever sees them.

## What changed

On 1 November 2026 I started [dbtour](https://github.com/victorsaly/dbtour). The same idea, opened up.

It reads the catalogue of a database, never the rows. It writes what it finds to one model file in your repository. From that file it renders Markdown that GitHub shows with diagrams, and one HTML page you can search, follow relations in and hand to an agent. An MCP server and a Claude Code plugin give an agent the same model, so it writes SQL from the real names.

By 17 November it was version 0.11.0 on npm, after more than a hundred commits.

Where did AI-assisted development help most? Two places. The first is SQLite, the database I use the least. The second is the plugs into other tools: the MCP server, the Claude Code plugin, the skill, and copying a table for whichever agent you use.

Both are the parts that turn my tool into something other people can pick up.

## Where I decided

AI did not decide. It did not make it a product by itself.

There were several iterations, as the code shows. A lot of preparation, testing and verification. And using it every day, the same way I used dbschema-markdown.

The good idea was already there in 2020. AI took away the distance between the idea and a product. The judgement stayed mine.

## What it is now

dbtour documents SQL Server and SQLite databases today; other databases follow its plan. It needs only read access to the catalogue. Passwords go to the system's keychain, never a file.

## The message

A good internal idea doesn't have to stay internal.
