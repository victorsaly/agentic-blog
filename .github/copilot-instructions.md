<!-- Why: GitHub Copilot reads this file before it works in the repo. It points at the rules every agent
here follows, so Copilot builds the same way Claude does. -->

# Working in this repository

1. Read `CLAUDE.md` first. Its rules apply to you exactly as written: origins under `thoughts/*/origin/`
   are never edited, every Markdown file has a `why:`, nothing publishes without a person merging, and the
   code standards (TypeScript strict, no `any`, zod at boundaries, named exports, tests next to the code).
2. For work on the framework (`packages/`, `roadbook.config.ts`, `agents/*/card.ts`), read
   `docs/roadbook-plan.md` and take the next open slice. Build only that slice.
3. Before opening a pull request, run:
   `npm run lint && npm run typecheck && npm run test && npm run check:why && npm run roadbook -- validate`
4. Use `.github/pull_request_template.md`. One concern per pull request. Never merge your own.
5. Reader-facing words: plain English, British spelling, never "converted" or "conversion" (see
   `site/PRODUCT.md`).
