---
why: >-
  The body of the pull request that brings this thought to the blogger for
  review, assembled by the publish agent from what the other agents wrote.
assembled: '2026-10-25'
---

**A year ago my son and I tried to build his game with AI, and after three to four weeks it could not do it. Today I am almost sure it would. The AI is better, and I know better how much to hand over, and how to ask and review.**

## What is in this PR

- `origin/transcript.md`: Victor's spoken origin, the source of everything below.
- `origin/answers.md`: his written answers to the interview questions, used for the game name, the Copilot-only detail and the rerun plan.
- `interview.md`: the questions asked after the transcript.
- `structure.md`: the message, the themes and the ten small ideas, with the title "Same idea, a year later".
- `versions/long.md`: the full story in the order he told it, with a "what changed from the origin" section.
- `versions/short.md`: the short version.
- `versions/linkedin.md`: the LinkedIn version, ending with the badge and the thought's URL.
- `voice/short.md`: the short version prepared for voice.
- `image/prompts.md`: the picture prompt. There is no `image/picture.png`, so nothing was drawn.
- `seo.md`: SEO notes. No model call was made, because the index switch is off.
- `sources.md`: the citations ledger. citations failed twice before it succeeded.
- `safety.md`: safety verdict, pass.
- `security.md`: security verdict, pass.
- `pull-request.md`: this pull request body, kept in the thought.
- `road.md`: which agents ran, in what order, on which model. 24 runs, with the failures and retries marked.

## What changed from the origin

- Cut the circling. The origin says "the idea is there" and "we were trying" several times. I kept each point once.
- Reordered. In the origin the reasons for the change come in the middle of one long sentence. I put them in their own section, before the blog, so a stranger can follow the order: the old attempt, what failed, what changed, the proof.
- Added the game name, WorldLeadersGame, and the repository link from the written answers.
- Added "I used only Copilot" and what went wrong ("shifting or forgetting the original request and orders") from the answers. The transcript only said it was "not capable".
- Added "It did not have as many skills as today, and the model was not clever enough". This comes from answer 5. I kept it as the AI's limit, not as a judgement on anyone's skill.
- Dropped "I didn't feel like I was in the stage of development at that moment to build the software". It is unclear in the transcript, and answer 5 says it more simply.
- Added "Claude in particular has shown a better approach" from answer 6.
- Added the how-it-works link from answer 7.
- Added the plan to rerun the original project, from answer 1. It closes the thought.
- Left out the part about discussing progress with his family and the feedback they gave, as he asked in answer 8, to avoid privacy issues.
- Left out the speech-recognition fragments "you talk to clock fair" and "talk by SDK with claw". I could not be sure what he meant, so I kept only "a web interface to talk to" and "a database". If he meant a specific service or Claude's SDK, he can add it back.
- Left out "and stuff" and "you know", which are spoken filler.
- Kept "and I review each one", "it is a shame" and "a completely different era" close to his words.
- Caveat: "almost certain" stays as he said it. Nothing has been rerun yet, so this version does not claim a result.

## Look at first

1. "It did not have as many skills as today, and the model was not clever enough to complete the task." (`versions/long.md`, "Where it stopped"). It is the blunt judgement on the AI, and the "not clever enough" wording may be harsher than Victor would say.
2. "It builds the blog automatically, without any major issues." (`versions/long.md`, "This blog is the proof of the feeling"). It is the strongest claim in the piece. It does not appear in `structure.md`'s small ideas, so check that Victor said it.
3. "It has a database, and a web interface to talk to." (`versions/long.md`, same section). The speech-recognition fragments were dropped here, so the wording may be less specific than what he meant.
