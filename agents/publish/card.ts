// Why: the publish agent's card. It assembles, it does not write, and a person merges what it assembles.
import { defineAgentCard } from '@roadbook/core';
import { coreStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'publish',
  phase: 5,
  reads: [
    'structure.md',
    'versions/*.md',
    'safety.md',
    'security.md',
    'sources.md',
    'image/',
    'road.md',
  ],
  writes: ['the pull request body', 'versions/linkedin.md (badge line appended)'],
  purpose: 'Assemble one pull request a reviewer can read in a minute, and record the road.',
  why: 'The last step before a human should make the human’s job short and honest: what is new, what changed, where to look.',
  inputs: [
    { name: 'versions', type: 'markdown' },
    { name: 'verdicts', type: 'markdown' },
  ],
  outputs: [
    { name: 'pull request body', type: 'markdown' },
    { name: 'road', type: 'markdown' },
  ],
  mustNot: [
    'Proceed when a safety or security verdict is hold or missing.',
    'Write new prose; it only assembles.',
  ],
  doneMeans: [
    { id: 'verdicts-pass', says: 'Safety and security verdicts are both pass.' },
    { id: 'whys', says: 'Every file in the pull request has a why.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.9 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.03, secondsPerRun: 60 },
  behaviour: coreStep(true),
  metrics: standardMetrics(0.9, 0.03),
  data: { sends: ['text', 'metadata'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
