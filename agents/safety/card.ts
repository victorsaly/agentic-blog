// Why: the safety guard's card. It never writes a word of the blog; it can only pass or hold, with a reason.
import { defineAgentCard } from '@roadbook/core';
import { guardStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'safety',
  phase: 5,
  reads: ['versions/*.md', 'structure.md'],
  writes: ['safety.md'],
  purpose:
    'Read everything about to leave, in every language, for hate, contempt or an attack, and hold it if found.',
  why: 'The blogger does not expect to write such things, but expects to be tired or careless in a language not his first.',
  inputs: [
    { name: 'versions', type: 'markdown' },
    { name: 'structure', type: 'markdown' },
  ],
  outputs: [
    {
      name: 'verdict',
      type: 'markdown',
      limit: 'pass, or hold with the sentence quoted and the reason',
    },
  ],
  mustNot: [
    'Rewrite or soften the text; the blogger decides.',
    'Comment on style, length or quality.',
  ],
  doneMeans: [
    { id: 'verdict', says: 'The verdict is exactly pass or hold.' },
    { id: 'quoted', says: 'Every hold quotes the exact sentence and names which rule it breaks.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.95 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.05, secondsPerRun: 60 },
  behaviour: guardStep(),
  metrics: standardMetrics(0.95, 0.05),
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
