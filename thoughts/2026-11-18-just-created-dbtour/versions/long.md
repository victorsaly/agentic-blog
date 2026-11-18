---
why: Written in a Claude Code session from Victor's written origin and answers, not by the convert agent. Victor's words give the story and the two judgements (where AI helped, where he decided). Dates, version numbers, commit count and features come from the two GitHub repositories and npm, checked on 2026-11-18. Victor did not answer who dbtour is for, so that section says only what the README says it does. Updated the same evening, as Victor asked in origin/update.md, with what 0.11.1 to 0.11.3 added and the new links to try it.
kind: long
language: en
converted_from: ../origin/text.md
updated: 2026-11-18
converted_by: claude-code
reviewed: true
---

# It worked for me. Now it works for you.

My side projects usually stay small: me and a few close colleagues. dbtour started that way, in 2020. AI-assisted development is how it became a product anyone can use.

## Where it started

I like to build tools for my own projects.

In January 2020 it was databases: several projects, each with its own SQL Server database. So I wrote [dbschema-markdown](https://github.com/victorsaly/dbschema-markdown): a command-line tool that read a database and wrote its schema as Markdown.

I hooked it to a blog. Every project's schema in one place, one search box over all of them.

## Where it stopped

It worked, for me and a few close colleagues. That is where my side projects usually stop: they do their job, and nobody else ever sees them.

## What changed

On 1 November 2026 I started [dbtour](https://skills.victorsaly.com/dbtour). The same idea, opened up.

It reads the catalogue of a database: tables, columns, keys, relations, indexes. It writes what it finds to one model file in your repository. From that file it renders Markdown that GitHub shows with diagrams, and one HTML page you can search, follow relations in and hand to an agent. An MCP server and a Claude Code plugin give an agent the same model, so it writes SQL from the real names.

By 17 November it was version 0.11.0 on npm, after more than a hundred commits.

Where did AI-assisted development help most? Two places. The first is SQLite, the database I use the least. The second is the plugs into other tools: the MCP server, the Claude Code plugin, the skill, and copying a table for whichever agent you use.

Both are the parts that turn my tool into something other people can pick up.

## Where I decided

AI did not decide. It did not make it a product by itself.

There were several iterations, as the code shows. A lot of preparation, testing and verification. And using it every day, the same way I used dbschema-markdown.

The good idea was already there in 2020. AI took away the distance between the idea and a product. The judgement stayed mine.

## What it is now

dbtour documents SQL Server, Azure SQL and SQLite databases today; PostgreSQL and MySQL follow its plan. Documenting needs only read access to the catalogue. Reading the data is your choice: give it a read-only login and it runs a SELECT, inside a transaction that is always rolled back. A SQLite file is opened read-only. Passwords go to the system's keychain, never a file.

The day this post went up, it reached version 0.11.3. Three things changed since 0.11.0.

- **The map answers a click.** Click a table and a card says what it is: its rows and size, its columns and key, every relation in and out. From the card you open its page, write SQL from it, add its neighbours or copy it for an agent. Click a line and the card names the columns it joins, and writes the join for you.
- **Several databases on one page.** The page opens on a list of them. You choose one, read it alone, and switch from the side.
- **A SQL Server on your own machine.** One in Docker, or a developer's own, can be set up now.

## Try it

You do not have to install anything to see it.

- [The live example](https://skills.victorsaly.com/dbtour/example): the page itself, with three databases on it. A made-up shop on SQL Server, and two well-known samples, Chinook and Northwind, as SQLite files.
- [The 30-second film](https://skills.victorsaly.com/dbtour#teaser): what it does with no setup.
- [The whole tour](https://skills.victorsaly.com/dbtour#film), a minute and a half with sound: the setup, the catalogue, a table's page, the map, queries, and an agent asking over MCP, against a real SQL Server.

How to start is on [the dbtour page](https://skills.victorsaly.com/dbtour). The code is on [GitHub](https://github.com/victorsaly/dbtour), and every change is in [the changelog](https://github.com/victorsaly/dbtour/blob/main/CHANGELOG.md).

## The message

It worked for me. Now it works for you.
