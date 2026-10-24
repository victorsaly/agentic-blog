// Why: the feedback agent's card. It changes only the files named by the feedback and may propose a route fix.
import { defineAgentCard } from '@roadbook/core';
import { coreStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'feedback',
  phase: 5,
  reads: ['feedback/*.md', 'versions/*.md', 'agents/*/PROMPT.md', 'profile.md'],
  writes: ['versions/*.md', 'agents/<name>/PROMPT.md', 'profile.md'],
  purpose: 'Rework versions in response to feedback and propose fixes for recurring patterns.',
  why: 'A complaint should fix the version it concerns; repeated complaints can reveal a route that needs to change.',
  inputs: [
    { name: 'feedback', type: 'markdown' },
    { name: 'versions', type: 'markdown' },
    { name: 'agent prompts', type: 'markdown' },
    { name: 'profile', type: 'markdown' },
  ],
  outputs: [{ name: 'reworked files', type: 'markdown' }],
  mustNot: [
    'Change parts of a version the feedback did not complain about.',
    'Change files outside versions, agent prompts and the profile.',
  ],
  doneMeans: [
    { id: 'scope', says: 'Only the versions named by the feedback are reworked.' },
    { id: 'preserve', says: 'Every part not mentioned in the feedback stays word for word.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.8 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.05, secondsPerRun: 90 },
  behaviour: coreStep(false),
  metrics: standardMetrics(0.8, 0.05),
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
