# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Readers of blog.victorsaly.com: people who follow Victor Saly's thinking on AI changing work, accountability, credibility, secure and scalable systems, apps and workflows. They arrive from LinkedIn or search, mostly on a phone, often between other things.
- The two readers who come first: Victor's daughter, who is dyslexic, and his son, who finds it hard to hold attention on a page. If they get the message straight away, anyone can.
- Victor himself in the studio: records or pastes a raw note, reviews what the agents produce, decides what merges.

## Product Purpose

A blog where every post starts as a raw voice or text note (the origin, never edited) and every published form (short, long, LinkedIn post, another language, drawing, voice) is a conversion that links back to it. Success: a reader gets the message in three lines, can go one screen deeper or walk the whole road, and can always open the untouched origin. Victor publishes more of his thinking without his voice being flattened into generic AI prose.

## Positioning

"Talked out loud, tidied by AI." The thought is real and stays Victor's; AI only tidies it and gives it structure. The point of the agentic blog is to let people express themselves freely and still publish clear, well-structured, well-documented posts. The origin is kept and shown; every post carries a switch to the original. Agents do the converting, one job each, reading a profile of how Victor talks; two of them can only say no; a human merges. Neighbouring blogs either hide AI involvement or publish AI prose with no source. This one shows the road from note to post.

## Operating Context

- Content lives in a public GitHub repository as Markdown with a `why:` on every file; a merged pull request is a published post.
- The site is static, deployed as a Cloudflare Worker; the studio (`/studio`) sits behind Cloudflare Access.
- Posts arrive in batches: a voice note on a walk, a pasted text from the phone; agents produce structure, versions, drawings, sources; Victor reviews on the page.
- Readers come from LinkedIn and search, on phones first.

## Capabilities and Constraints

- Three depths per post: message (two or three lines), idea (one screen), road (everything), plus the origin and the sources. On the page these are tabs: The idea, Where it came from, The road, Sources.
- Themes classify posts: AI changing work, Accountability, Credibility, Scalable and secure, Apps and workflows. A post can carry several. A graph view of themes and small ideas is planned for a later phase.
- Home shows the newest ten posts; an archive lists all; a search page exists; theme pages exist.
- Drawings: linocut prints in black and white, generated per post and reviewed; Victor is the recurring drawn person. In dark mode drawings stay ink on paper, dimmed, on a paper margin; inverting turned faces dark and hair white. Small icons invert.
- Font switch (Atkinson Hyperlegible to Lexend) and theme switch (light and dark) in the header.
- Private by default: robots are kept out until Victor flips `index: true`.
- Readers can comment on a post: a name, an optional email only Victor sees, and the words. Every comment waits for Victor's approval in the studio before anyone sees it. Spam is stopped with Turnstile, a rate limit and a hidden field, not with tracking. Kept: name, comment, email if given; removal on request to info@victorsaly.com.
- Undecided: replies to comments; publishing languages beyond English; a reader voice version.

## Brand Commitments

- Name: Victor Saly. Tagline: Talked out loud, tidied by AI.
- Reader-facing words avoid programming terms such as "converted" or "conversion": say the thought is tidied and given structure by AI. ("Conversion" stays an internal word for agents and code.)
- Voice: plain words, feeling before mechanism, British spelling, short sentences in the message, questions left hanging, no AI slop words. English is not his first language and the occasional odd preposition is part of the voice.
- Visual commitments made binding in CLAUDE.md and later decisions: monochrome (black on white, white on black); one colour, marigold, on the message of a post, on each title of a list page and on search matches; no cards, shadows, gradients or decoration; structure by spacing and ink rules in three weights; motion only when the reader asks; linocut drawings with Victor as the recurring person; Atkinson Hyperlegible body at 19px with a Lexend switch; 60ch measure.
- Licence: code MIT; content all rights reserved for now.

## Evidence on Hand

- Two published thoughts under `thoughts/`: "Talked out loud, tidied by AI" (2026-10-23, no drawings yet) and "What counts as evidence of competence" (2026-10-23, cover and eight section drawings, sources).
- Origins as text transcripts; audio recording flow exists but no published audio yet.
- `profile.md` with Victor's voice, grown by the profile agent.
- Linocut icons for the four tabs under `site/src/assets/icons/`.
- No testimonials, metrics, subscriber counts or press. Do not invent any.

## Product Principles

1. The origin is sacred: never edited, always one click away.
2. Message first: a dyslexic or distracted reader gets the point in three lines before anything else asks for attention.
3. Show the road, not just the building: every conversion says what changed and why.
4. Human decides: agents propose, Victor merges; nothing publishes itself.
5. Quiet by default: one loud thing per page, and that thing is the message.

## Accessibility & Inclusion

WCAG 2.2 AA is the floor; axe runs in CI. Keyboard reaches everything. Dyslexia-friendly type and a second reading face. Reduced motion respected. Tap targets at least 44px. Drawings carry alt text written for the reader, not the generator.
