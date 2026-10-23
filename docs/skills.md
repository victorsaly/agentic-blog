# Skills for this repo

Why: the site and the agents are built with the same tools they use, under the same rules. These skills are
installed into the repo's `.claude/` folder by `scripts/install-skills.sh`, so they apply here and nowhere else.

| Layer | Skill | What it decides |
| --- | --- | --- |
| Design taste | Impeccable (`pbakaus/impeccable`) | aesthetic direction, typography, the critique before merge |
| Interaction | Emil Kowalski (`emilkowalski/skill`) | what moves (very little), phone fixes, worst-case data |
| Tiebreaker | Anthropic `frontend-design` | when the two above disagree |
| Engineering | ECC, selectively | coding standards, verification loop, Agent SDK patterns, prompt tuning, research, security review |

Order before any UI work: `emil-design-eng` → Impeccable → build → `/impeccable critique` → `break-ui` → merge.

## ECC bundle

| ECC item | Use here | From phase |
| --- | --- | --- |
| coding-standards, frontend-patterns | the TypeScript, React and Node rules every PR is checked against | 0 |
| project-guidelines-example | the shape of `CLAUDE.md` | 0 |
| verification-loop, quality-gate, e2e-runner | the CI gate: build, tests, Playwright screenshots, axe | 0 |
| deployment-patterns | the Cloudflare deploy and rollback workflow | 0 |
| claude-api, agent-harness-construction | the Agent SDK programs and their tool sets | 1 |
| blueprint | turning each phase into a multi-session construction plan | 1 |
| prompt-optimizer, eval-harness | tuning each agent's `PROMPT.md` against Victor's corrections | 2 |
| article-writing, content-engine, crosspost | the convert agent's base for long form and platform posts | 2, 5 |
| continuous-learning-v2 | the nearest thing to the profile agent | 3 |
| cost-aware-llm-pipeline | cheap steps on cheap models, with a budget | 3 |
| deep-research, search-first | citations and drill-down agents | 4 |
| security-review, security-scan | the security agent's weekly run and PR checks | 5 |

Not installed on purpose: ECC language packs (Python, Go, JVM, Swift, C++, Perl), industry skills, investor
material; Emil's `animate-expo`, `write-swift`, `apple-design`, `ask-sonner`. Nothing here needs them.

## Claude Code permissions (add by hand)

Add this to `.claude/settings.json` on your Mac (the file is deliberately not committed by the scaffold):

```json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Bash(npm test*)", "Bash(npx astro *)", "Bash(git status*)", "Bash(git diff*)"],
    "deny": ["Edit(thoughts/**/origin/**)", "Write(thoughts/**/origin/**)", "Bash(git push --force*)"]
  }
}
```

The two `deny` lines are the "origins are never edited" rule, enforced at the editor as well as in CI.
