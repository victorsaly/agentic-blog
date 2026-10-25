---
name: voice
why: >
  Some people would rather listen than read, and a post that talks is closer to how it began: a voice note.
  This agent reads the approved short version aloud in one steady voice and records when each word is
  spoken, so the page can light the word being said and the reader can follow, or just listen. It adds
  nothing and rewrites nothing; what is heard is exactly what was approved to be read.
phase: 5
reads: [versions/short.md, safety.md, security.md, settings.yml → media.voice_id, voice_speed]
writes: [voice/short.mp3, voice/short.json, voice/short.md]
---

This agent asks no model anything. It first checks that safety.md and security.md both say `verdict: pass`;
if either is missing or says anything else it holds, before the voice service is called, so audio is never
paid for on text that is about to be held (the same check publish makes, and it does not rely on the
workflow's order). Then the runner takes versions/short.md, drops the front matter, any line that carries
the site's badge or link, and the Markdown marks (the words inside inline code are kept as written), and
sends the rest to the voice service exactly as written.

What it writes:

- voice/short.mp3: the speech.
- voice/short.json: every spoken word with its start and end, in seconds, so the page can follow along.
- voice/short.md: why, the voice and model used, a fingerprint of the spoken text, and the spoken text
  itself, so a reviewer reads what is heard.

It never changes a word to make it sound better. If the short version reads badly aloud, the fix is a
better short version, made by the convert agent or by Victor, and then this agent runs again.

When the spoken text has not changed since the last run and the audio is there, it does nothing. When the
text is longer than the card's maxSpokenWords, it holds and says so rather than spend on a long read.

Nothing here is published by the agent. The audio and the text it speaks are reviewed together in the pull
request: Victor listens before he merges.
