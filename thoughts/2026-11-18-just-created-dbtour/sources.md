---
why: Every claim in the post gets a door out, and nothing is shown until Victor has opened the links himself. The post leans only on Victor's own two projects, so every door is his own repository, package or skills page, checked with the GitHub and npm command-line tools.
checked: 2026-11-18
reviewed: true
updated: 2026-11-18
---

# Sources for "It worked for me. Now it works for you."

**How I checked.** I read each repository's details and README with the GitHub command-line tool, and the packages with `npm`, on 2026-11-18. Victor still has to open every link before it goes live. The last four rows were added the same evening, after dbtour 0.11.3, from the changelog and the dbtour page, with every link opened.

| Mentioned in the post | Door out | Opened | What is there |
|---|---|---|---|
| dbschema-markdown, started in January 2020, a CLI that writes a SQL Server schema as Markdown | [victorsaly/dbschema-markdown](https://github.com/victorsaly/dbschema-markdown), GitHub | 2026-11-18 | The repository, created 20 January 2020. Its README shows the command line, a SQL Server connection string, and writing the Markdown between comment markers in a file. |
| dbtour, started on 1 November 2026: structure from the catalogue, data only through a read-only login, Markdown with diagrams, one page, an MCP server, a Claude Code plugin and skill, SQL Server and SQLite, keychain | [victorsaly/dbtour](https://github.com/victorsaly/dbtour), GitHub | 2026-11-18 | The repository, created 1 November 2026, with more than a hundred commits on main. Its README describes each feature the post names. |
| dbtour's page: what it is and how to start | [dbtour](https://skills.victorsaly.com/dbtour), skills.victorsaly.com | 2026-11-18 | Victor's own page for dbtour, titled "dbtour: schema docs for SQL Server and SQLite, for people and agents". The post links it as the place to start. |
| Version 0.11.0 on npm by 17 November | [dbtour](https://www.npmjs.com/package/dbtour), npm | 2026-11-18 | The package page. Version 0.11.0, published 17 November 2026, beside the SQL Server, SQLite, explorer and keychain packages. |
| The map answers a click; several databases on one page; a SQL Server on your own machine; 0.11.3 the day the post went up | [CHANGELOG.md](https://github.com/victorsaly/dbtour/blob/main/CHANGELOG.md), GitHub | 2026-11-18 | The release notes for 0.11.1 (17 November), 0.11.2 and 0.11.3 (18 November), and npm shows 0.11.3 published 18 November 2026. |
| The live example: three databases on one page, a made-up shop on SQL Server, Chinook and Northwind as SQLite files | [dbtour example](https://skills.victorsaly.com/dbtour/example), skills.victorsaly.com | 2026-11-18 | The page dbtour renders for its `examples/several`, on the web. The README links it as "try the live example". |
| The 30-second film | [dbtour, the teaser](https://skills.victorsaly.com/dbtour#teaser), skills.victorsaly.com | 2026-11-18 | The README calls it "what it does with no setup". |
| The whole tour, a minute and a half with sound | [dbtour, the film](https://skills.victorsaly.com/dbtour#film), skills.victorsaly.com | 2026-11-18 | The README lists what it shows: the setup, the catalogue, a table's page, the map, queries, and an agent asking over MCP, against a real SQL Server. |

## Notes for Victor

- **"A blog".** Your answer says dbschema-markdown "was hooked to another blog". The post says "a blog", names no blog and no employer, and calls it your own projects and a few close colleagues, as you asked.
- **SQL Server in 2020.** I took SQL Server from dbschema-markdown's README (its connection string). Your answers do not say it.
- **The diagrams.** You asked for infographics about database management. They are three of the site's own diagrams (diagram/diagrams.md), drawn in its type rather than as pictures, with every label taken from the long version. "Rows and size, as the database counts them" comes from the README's example page ("as the database counted them").
- **Azure SQL, PostgreSQL and MySQL.** The README says it works with Azure SQL today and that PostgreSQL and MySQL follow the plan; the long version now says both.
