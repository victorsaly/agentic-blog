// Why: the profile agent's card. Its lines are proposals; the blogger decides what becomes part of the profile.
import { defineAgentCard } from '@roadbook/core';
import { coreStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'profile',
  phase: 3,
  reads: [
    'origin/*.md',
    'origin/answers.md',
    "git diff of versions/*.md between the agent's draft and the merged file",
    'profile.md',
  ],
  writes: ['profile.md'],
  purpose: 'Learn the blogger’s voice and preferences from their origins and edits.',
  why: 'The blogger’s own words and changes show how future versions should sound; suggestions remain theirs to accept.',
  inputs: [
    { name: 'origin', type: 'markdown' },
    { name: 'answers', type: 'markdown', optional: true },
    { name: 'review diff', type: 'text' },
    { name: 'profile', type: 'markdown' },
  ],
  outputs: [{ name: 'profile suggestions', type: 'markdown' }],
  mustNot: [
    'Infer health, mood or personality from the blogger’s words or tone.',
    'Remove or rewrite any line the blogger wrote in the profile.',
  ],
  doneMeans: [
    { id: 'preserve', says: 'Every profile line written by the blogger remains unchanged.' },
    { id: 'evidence', says: 'Each proposed observation is supported by a quoted example.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.8 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.03, secondsPerRun: 60 },
  behaviour: coreStep(false),
  metrics: standardMetrics(0.8, 0.03),
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
