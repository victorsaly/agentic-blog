---
why: >
  The site is public, so this page has to say what it is to a search tool and to an AI answer engine,
  in the same plain words Victor would use. The page is not built yet, so I could not check the real HTML.
  Below is what the built page must carry, with the exact text to use.
checked: 2026-10-25
index: true
---

# SEO: Same idea, a year later

**Status:** the page is still a draft (`draft: true`) and not built. Nothing below could be verified in real HTML, so every item is open. Nothing is published or indexed until the draft flag is removed. That decision is Victor's, not mine.

## Proposed title (45 characters)

`Same idea, a year later: AI and my son's game`

It says what the post is about and promises nothing it doesn't say. The on-page heading can stay "Same idea, a year later".

## Proposed description (136 characters)

`A year ago AI could not build my son's game. Today I am almost sure it could: the AI is better, and I know better how to ask and review.`

This is the message, shortened to fit. It keeps "almost sure", because the post says "almost" and the proof is still to come.

## Checklist for the built page

- [ ] **`<title>`**: `Same idea, a year later: AI and my son's game`
- [ ] **Meta description**: `<meta name="description" content="A year ago AI could not build my son's game. Today I am almost sure it could: the AI is better, and I know better how to ask and review.">`
- [ ] **Canonical**: `<link rel="canonical" href="https://blog.victorsaly.com/<slug>/">`. The slug is not set, so I suggest `same-idea-a-year-later`. It must match the sitemap entry exactly.
- [ ] **`article:published_time`**: `<meta property="article:published_time" content="2026-10-25">`. Use the real publish date if it differs from the draft date.
- [ ] **JSON-LD Article**, with these fields:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Same idea, a year later: AI and my son's game",
    "description": "A year ago AI could not build my son's game. Today I am almost sure it could: the AI is better, and I know better how to ask and review.",
    "datePublished": "2026-10-25",
    "inLanguage": "en",
    "author": { "@type": "Person", "name": "Victor Saly", "url": "https://blog.victorsaly.com" },
    "mainEntityOfPage": "https://blog.victorsaly.com/<slug>/"
  }
  ```
- [ ] **hreflang**: only `en` exists today (`language: en`). Add `<link rel="alternate" hreflang="en" href="…canonical…">` and the same URL as `hreflang="x-default"`. Add one line per language when another version exists. Victor has not yet said which languages or in which order, so I have not guessed any.
- [ ] **Sitemap**: add `https://blog.victorsaly.com/<slug>/` with `<lastmod>2026-10-25</lastmod>` to `sitemap.xml`. Make sure the file is not listed while the page is still a draft.
- [ ] **Link to the long version**: the page links to `versions/long.md`. In the built page this must point to the built URL of the long version, not to a `.md` file. Otherwise the link breaks and a crawler can't follow it.
- [ ] **Long version page**: give it its own title and description, a canonical pointing to itself, and a visible link back to this short page. Don't copy this page's description.

## Left alone on purpose

- No keywords added, and nothing hidden.
- The title does not say "AI can now build it". The post says "almost sure" and the proof (rerunning WorldLeadersGame) is still to come.
