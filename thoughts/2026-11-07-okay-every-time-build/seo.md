---
why: >
  The index switch is on, so this page has to say what it is to search tools and AI answer engines in
  plain words. The page is not built yet and the thought is still a draft, so I could check the source
  but not the built head. Every "not verified" below is a check to repeat after the build.
checked: 2026-11-07
index: true
---

# SEO checklist: "Every agent takes something away"

## Verdict

The source is ready for search. The page is not live yet: `draft: true` and no build exists. Nothing below can be confirmed in the built HTML until you publish.

## Title (proposal)

**Every agent takes something away** (32 characters, limit 60)

Keep it. It is the post's own title and promises nothing the post does not say.

## Description (proposal)

The message is about 225 characters, too long to cut well as it stands. I propose this line for structure.md's front matter:

```yaml
description: >
  Every AI agent takes something away. Decide what before you build it. I am pro AI, and I want us to be honest about the price.
```

That is 126 characters (limit 155). It uses only your words and drops the middle sentence ("Building an agent is a decision about what people are used for…"), which stays in the post. Take it or leave it.

## Checklist

| # | Check | Status | Exact fix |
|---|---|---|---|
| 1 | `<title>` under 60 characters | Not verified (not built) | After the build, confirm it reads `Every agent takes something away`, with or without the site name, still under 60. |
| 2 | `<meta name="description">` under 155 | Not verified; source has none | Add the `description:` line above to structure.md and confirm the template uses it, not the long message. |
| 3 | `<link rel="canonical">` | Not verified | Must be the absolute URL on `https://blog.victorsaly.com`, ending the same way as the sitemap entry. |
| 4 | `article:published_time` | Not verified | Must be `2026-11-07`, from the `date:` in front matter. |
| 5 | JSON-LD `BlogPosting` with author and `inLanguage` | Not verified | See the snippet below. |
| 6 | `hreflang` for each language version | Not verified; only `en` exists | Emit `hreflang="en"` and `x-default` pointing to the canonical. Add each other language when it exists, and make every version link back. |
| 7 | Share picture: `og:image`, `twitter:card` = `summary_large_image` | Not verified | Run `npm run social:cards`. Confirm this post's card exists in `site/public/social` and that `og:image` is an absolute URL to it. |
| 8 | Sitemap lists the page | Not verified | After the build, confirm the URL is in the sitemap. A draft will not appear, so set `draft: false` first. |
| 9 | Link between the short version and the long version | Needs checking | structure.md links to `versions/long.md`. Confirm the built page links to the long version's public URL, not the source file path, and that the long version points back. |
| 10 | Draft flag | Blocking | `draft: true` keeps the page out of the build. Change it to `false` when you decide to publish. |

## JSON-LD to expect

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Every agent takes something away",
  "description": "Every AI agent takes something away. Decide what before you build it. I am pro AI, and I want us to be honest about the price.",
  "datePublished": "2026-11-07",
  "inLanguage": "en",
  "author": { "@type": "Person", "name": "Victor Saly", "url": "https://blog.victorsaly.com" },
  "mainEntityOfPage": "<canonical URL>",
  "image": "<absolute URL of this post's social card>"
}
```

## Before you publish the long version

The structure note says the transcript stops mid-sentence ("we should también as to to") and that the name "Steven Case" is unclear. A search tool will index whatever you publish, so fix both in the long version first. A wrong name hurts credibility more than a missing one.

## Left out on purpose

No keyword list, no hidden text, no title that promises more than the post says.
