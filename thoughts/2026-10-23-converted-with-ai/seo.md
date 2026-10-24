---
why: >
  The site is public now, so this page has to say what it is to a search tool or an AI answer engine as
  plainly as it says it to a person. This is the check of the built head against that, with the exact fix
  for each gap. Nothing clever, nothing hidden.
checked: 2026-10-24
index: true
---

# SEO check: "Converted with AI, not made by AI"

The switch is on (`publishing.index: true`), and the page agrees: it carries `robots: index, follow`. The page is `https://blog.victorsaly.com/thoughts/2026-10-23-converted-with-ai.html`.

Three things need fixing: the description, the JSON-LD and hreflang. The sitemap I cannot confirm from the head.

## Title

- [x] **Title is fine.** "Converted with AI, not made by AI — Victor Saly" is 47 characters, under 60. It says what the post says.
- [x] `og:title` matches it.

## Description

- [ ] **Too long, and it stops mid-sentence.** The built description is about 215 characters and ends "…the tool only changes the…". Search tools show about 155, and the cut is in an ugly place. `og:description` has the same problem.
  - **Fix:** add a `description` field to the front matter and have the build use it for both `description` and `og:description`, falling back to `message` only if it is missing. Do not shorten `message`. It is the three-line message for readers and should stay whole.
  - **Proposed description (138 characters):**
    > Every post starts as a messy voice note, kept as spoken. Everything you read is a conversion, badged as such, one click from the original.
  - It uses only what the message already says. It does not promise anything the post does not deliver.

## Canonical and dates

- [x] `canonical` is present and absolute, and matches `og:url`.
- [x] `article:published_time` is present: `2026-10-23T00:00:00.000Z`. It matches the front matter date.
- [x] `og:type` is `article`.

## Structured data

- [ ] **No JSON-LD Article in the head.** I see no `application/ld+json` block, so a machine has no stated author, date or language except from the meta tags.
  - **Fix:** add this to the head of every thought, filled from the front matter. This is the one for this page:
    ```html
    <script type="application/ld+json">
    {
      "@context":
