---
why: >
  The road is the human explanation of the orchestration: which tools ran, in which order, with which
  instructions, and what I changed. For the first post the road is unusual, because the agents did not
  exist yet; it was converted in a chat with Claude on 23 October 2026 while the plan for the agents was
  being written in the same conversation. That is recorded here honestly, not tidied into a pipeline.
---

# How the first post was made

| Step | Who | What happened |
| --- | --- | --- |
| 1 | Victor | Twelve voice notes dictated into the phone over about an hour, pasted into a chat with Claude as they arrived. Kept verbatim in `origin/transcript.md`. |
| 2 | Claude (chat) | After each note, one or two sections were drafted in Victor's voice and inserted into a living document, with the raw note kept on an "Origin" tab. Instruction, in Victor's words: "it sounds like me, no slips, no complex words, more about feeling and explanation of the AI world today". |
| 3 | Claude (chat) | Three drawings were made for the document: the conversion flow, the graph, the agent flow. The Markdown version carries one of them as ASCII. |
| 4 | Claude (chat) | A plan of action was drafted in a second document: stack, skills, repo layout, phases, week one. |
| 5 | Claude Code | This repo was scaffolded from the plan: site, agents, workflows, this thought. |
| 6 | Victor | Review pending. Every `versions/*.md` has `reviewed: false` until Victor has read it and changed what sounds wrong. |

# Prompts that shaped it

- Voice: "like me, plain words, feeling before mechanism, no AI slop".
- Structure: one section per idea in the note, in the order a stranger could follow, not the order spoken.
- Honesty: every caveat the conversion added that the notes did not say is listed in the last section of `versions/long.md`.

# What the agents will do differently next time

- The interview agent will ask before the structure is written; here the questions were never asked.
- The audio will be kept; here only the dictated text survived, so pauses, stress and speakers are absent.
- The safety and security checks will run before merge; here they are the same review Victor does by hand.
