---
why: >
  The switch is on, so I checked the built page the way a search tool or an AI answer engine reads it. Two things are missing (structured data and the sitemap link) and one is wrong (the description is cut off mid-sentence). Nothing here is clever or keyword-driven; the proposed title and description say what the post says, in your words.
checked: 2026-10-24
index: true
---

# SEO check: "What counts as evidence of competence"

**Note on the switch:** I was not given settings.yml, so I could not read `publishing.index` directly. The built page carries `robots: index, follow`, which matches the switch being on, so I went ahead. If it is actually off, ignore everything below. I changed nothing in any file.

## Proposed title and description

- **Title (51 characters):** What counts as evidence of competence — Victor Saly
  - The built page already has this. Keep it.
- **Description (146 characters):** AI-assisted work is not cheating. The skills bar is raising, and the human still decides what stays. Think first, build after, keep your identity.
  - It is the message, shortened. It keeps your "raising" and the landing, and adds nothing you did not say.

## Checklist

- [x] **Title** is present, under 60 characters, and says what the post is about.
- [ ] **Meta description** is present but needs a fix.
  - It is about 205 characters, over the 155 limit.
  - It is cut off with "…" in the middle of a sentence.
  - It lost the hyphen in "AI-assisted".
  - Fix: replace the `description` content with the 146-character version above.
- [ ] **og:description** has the same problem. Fix: use the same text as the meta description.
- [x] **Canonical** is present: `https://blog.victorsaly.com/thoughts/2026-10-23-productive-friction-counts-evidence.html`.
  - Check that this is the URL the page is actually served at.
  - Optional: the slug says "productive friction", which the post never says. Slug and title should agree, so consider renaming it to `…-what-counts-as-evidence-of-competence`, with a redirect from the old address.
- [x] **article:published_time** is present: `2026-10-23T00:00:00.000Z`.
- [x] **`<html lang="en">`** is present.
- [x] **robots** is `index, follow`.
- [ ] **JSON-LD Article** is missing from the head. Fix: add this inside `<head>`:

  ```html
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "What counts as evidence of competence",
    "description": "AI-assisted work is not cheating. The skills bar is raising, and the human still decides what stays. Think first, build after, keep your identity.",
    "author": { "@type": "Person", "name": "Victor Saly", "url": "https://blog.victorsaly.com" },
    "datePublished": "2026-10-23",
    "inLanguage": "en",
    "mainEntityOfPage": "https://blog.victorsaly.com/thoughts/2026-10-23-productive-friction-counts-evidence.html"
  }
  </script>
  ```

  Generate the values from front matter (`title`, `date`, `language`, `message`) so they never drift from the page. I left out `dateModified` because the file does not carry one.
- [ ] **hreflang** is missing.
  - Right now there is only an English version, so this is not urgent.
  - As soon as a second language exists, add one `<link rel="alternate" hreflang="xx" href="…">` per version.
  - Include a self-reference for `en` and an `x-default` pointing to the English page, and make sure each version points back.
  - The languages and their order are still an open question in your profile.
- [ ] **Sitemap** could not be verified from the head, and the head has no link to it.
  - Fix 1: add `<link rel="sitemap" href="/sitemap-index.xml">` to the head.
  - Fix 2: open `/sitemap-index.xml` (or `/sitemap.xml`) on the built site and confirm the canonical URL above is listed.
  - Fix 3: add a `Sitemap:` line to robots.txt.
- [ ] **Link to the long version**: the page points to `versions/long.md`. Confirm that this resolves to a built, indexable page, not a raw file path, and that it links back to this page. If it is not published, remove the link or leave it as plain text.

## Not proposed

I did not suggest keywords, extra tags, or a more clickable title. The title and description already say what the post says, and that is enough.
