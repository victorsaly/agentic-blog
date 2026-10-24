---
why: >
  This is the publish check on "What counts of evidence of competence": did anything leave that belongs to someone other than Victor, or any secret, token or internal URL? I checked every version and the sources list. It passes. The npm audit is in its own section because it belongs to the weekly job, not to this verdict. I did not redact or change any text.
checked: 2026-10-23
verdict: pass
---

# Security check: "What counts as evidence of competence"

## What I scanned

- `versions/linkedin.md`, `versions/long.md`, `versions/short.md`
- `sources.md`
- `structure.md`

I did not have `origin/text.md` in front of me, so I did not scan it. Nothing in the versions suggests it holds anything the versions do not, but if the origin is published as it is, it needs its own check.

## Data about other people: none found

- **Ray Kurzweil, *The Age of Spiritual Machines* (1999).** He appears only in the converter's notes in `long.md` and in the "left out" list in `sources.md`. He is a public figure and the book is public. The book is not in the post itself.
- **Lance Eliot** (in the Forbes URL). He is a public author, and the link is a published article.
- **Companies and institutions** (KPMG, University of Melbourne, Harvard Business Review, Pangram, Anthropic, Duke University, Europol). These are organisations, not private details about people.
- **"A doctor interested in holistic medicine".** This is a made-up example in the second person, not a real person.
- **"Teenage belief" in the Kurzweil note** is Victor's own history, so it is his to share.
- **The call centre comparison** is not in any published version. It names no one anyway.

I found no emails, phone numbers, addresses, dates of birth, employers with a role, children with a school, or health or financial details about anyone. The "daughter" and "son" in the blogger profile appear in none of the files.

## Secrets, tokens and internal URLs: none found

- Every link in `sources.md` is a public page.
- The only internal path is `../origin/text.md` in the front matter, which is a relative repo path and not a secret.
- The only address of Victor's own is `blog.victorsaly.com`, which is public.

## npm audit

| Package | Severity | Fix available |
|---|---|---|
| esbuild | moderate | yes |
| vite | high | yes |
| zod | high | yes |

The audit gave me only severity and "fix available". It does not give the advisory link, the fix version, or whether the bump is a patch, minor or major. I will not guess those, and I cannot open the pull requests from here.

For each package I need the output of `npm audit --json`, or at least `npm audit fix --dry-run`. With it I will open one pull request per dependency, with the version bump and the advisory link in the body. A major bump gets a line saying what changes.

- **vite and zod (high):** these come first once I have the details.
- **esbuild (moderate):** it often arrives through vite, so fixing vite may clear it. I cannot confirm that from this output.

This does not hold the post. The post ships no dependency code, so the audit is a separate job from the publish verdict.

## Verdict: pass

Nothing in the post, the versions or the sources belongs to someone other than Victor, and there are no secrets. The three audit findings are waiting for their advisory details.
