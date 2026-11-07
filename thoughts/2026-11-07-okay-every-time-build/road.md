---
why: >
  This is the road of the thought: which agents ran, in what order, on which model, and when. A reviewer can
  see how the words got from Victor's voice to this pull request, and where a step failed. Each line comes from
  the run ledger. Nothing here is inferred.
thought: 2026-11-07-okay-every-time-build
updated: 2026-11-07
---

# The road

Reasoning agents run on claude-sonnet-5-5 unless their PROMPT.md says otherwise. I could not see any PROMPT.md override, so I list that model for every agent that makes a model call.

| # | Date | Agent | Model | Note |
|---|---|---|---|---|
| 1 | 2026-11-07 | interview | claude-sonnet-5-5 | Ran. |
| 2 | 2026-11-07 | structure | claude-sonnet-5-5 | Ran. |
| 3 | 2026-11-07 | convert | claude-sonnet-5-5 | Ran. Wrote versions/long.md and versions/short.md. |
| 4 | 2026-11-07 | image | claude-sonnet-5-5 | Wrote the image prompt. It draws with Workers AI only when image/picture.png exists, and that file is not in the thought, so no picture was drawn. |
| 5 | 2026-11-07 | diagram | claude-sonnet-5-5 | Failed (exit 1). Ledger entry only. |
| 6 | 2026-11-07 | citations | claude-sonnet-5-5 | Ran. |
| 7 | 2026-11-07 | seo | none | No model call while the index switch is off. |
| 8 | 2026-11-07 | drilldown | claude-sonnet-5-5 | Ran. |
| 9 | 2026-11-07 | diagram | claude-sonnet-5-5 | Second run after the failure. Ran. |
| 10 | 2026-11-07 | safety | claude-sonnet-5-5 | Verdict: pass. |
| 11 | 2026-11-07 | security | claude-sonnet-5-5 | Verdict: pass. |
| 12 | 2026-11-07 | voice | claude-sonnet-5-5 | Ran. Wrote voice/short.md. |
| 13 | 2026-11-07 | publish | claude-sonnet-5-5 | Assembled the pull request. No prose written. |

Run id for steps 1 to 12: 2026-11-07-okay-every-time-build
