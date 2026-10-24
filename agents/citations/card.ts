// Why: the citations agent's card. Every claim gets a door out, and no door is published unopened.
import { defineAgentCard } from '@roadbook/core';
import { optionalStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'citations',
  purpose: 'Find what each claim in a post rests on and link to it where the name appears.',
  why: 'A thought with a source is worth more than one without, and the best a post can do is send you somewhere better.',
  inputs: [
    { name: 'structure', type: 'markdown' },
    { name: 'long', type: 'markdown' },
  ],
  outputs: [
    {
      name: 'sources',
      type: 'markdown',
      limit: 'reviewed: false until the blogger opens each link',
    },
  ],
  mustNot: [
    'Guess or build a URL; a source that cannot be found is written as "no door found".',
    'Cite a content farm or a page that only repeats the claim.',
  ],
  doneMeans: [
    { id: 'opened', says: 'Every listed page was opened, with the date it was opened.' },
    {
      id: 'unreviewed',
      says: 'The sources file is marked unreviewed until the blogger reviews it.',
    },
  ],
  qualityBar: { approvedWithoutRewrite: 0.8 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.15, secondsPerRun: 240 },
  behaviour: optionalStep(),
  metrics: standardMetrics(0.8, 0.15),
  variables: {
    maxSources: {
      type: 'number',
      default: 12,
      why: 'Enough doors out to check every claim, few enough that each one gets opened.',
    },
  },
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
