#!/usr/bin/env bash
# Why: the site and the agents are built under the same design and engineering rules. This installs the
# skills those rules come from, into this repo's .claude/ folder, so Claude Code picks them up here only.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Impeccable (design taste and critique)"
npx -y skills add pbakaus/impeccable

echo "→ Emil Kowalski's design-engineering skills (motion discipline, mobile, break-ui)"
npx -y skills add emilkowalski/skill

echo "→ ECC, selectively (see docs/skills.md for the bundle and why)"
npx -y ecc-universal install \
  coding-standards frontend-patterns project-guidelines-example \
  verification-loop deployment-patterns \
  claude-api agent-harness-construction blueprint \
  prompt-optimizer eval-harness \
  article-writing content-engine crosspost \
  continuous-learning-v2 cost-aware-llm-pipeline \
  deep-research search-first \
  security-review security-scan \
  || echo "ECC selective install: check the package's current CLI flags with: npx ecc-universal --help"

echo "Done. Restart Claude Code in this folder to load the skills."
