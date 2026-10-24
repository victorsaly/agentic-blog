// Why: the drill-down agent's card. Short wiki pages for what a post leans on, made from reviewed sources only.
import { defineAgentCard } from '@roadbook/core';
import { optionalStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'drilldown',
  purpose: 'Write a short wiki page for each book or person a post leans on.',
  why: 'A name a reader does not know should open onto a short, checked page instead of a dead end.',
  inputs: [
    { name: 'sources', type: 'markdown' },
    { name: 'long', type: 'markdown' },
  ],
  outputs: [{ name: 'wiki pages', type: 'markdown', limit: 'under 300 words each' }],
  mustNot: [
    'Use a door out that is not in the sources file.',
    'Add opinions the blogger did not express.',
  ],
  doneMeans: [
    { id: 'length', says: 'Each page is under 300 words.' },
    { id: 'sourced', says: 'Each page lists two or three doors out from the sources file.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.8 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.1, secondsPerRun: 120 },
  behaviour: optionalStep(),
  metrics: standardMetrics(0.8, 0.1),
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
