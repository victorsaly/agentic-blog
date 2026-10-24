// Why: the diagram agent's card. Most posts need no diagram, and the card makes "none" a correct answer.
import { defineAgentCard } from '@roadbook/core';
import { optionalStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'diagram',
  phase: 4,
  reads: ['structure.md', 'versions/long.md', 'profile.md'],
  writes: ['diagram/diagrams.md'],
  purpose: 'Describe a diagram for the few places in a post where a process reads better as boxes.',
  why: 'A process or a change is faster to read as a picture; an opinion is not.',
  inputs: [
    { name: 'structure', type: 'markdown' },
    { name: 'long', type: 'markdown' },
  ],
  outputs: [{ name: 'diagrams', type: 'json', limit: 'zero or more, usually zero' }],
  mustNot: [
    'Make a diagram for an opinion, a feeling or a list of tips.',
    'Put a claim or a number in a box that the text does not make.',
  ],
  doneMeans: [
    { id: 'from-text', says: 'Every label in a diagram comes from the blogger’s words.' },
    { id: 'readable', says: 'Every diagram has a text alternative for a screen reader.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.8 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.05, secondsPerRun: 60 },
  behaviour: optionalStep(),
  metrics: standardMetrics(0.8, 0.05),
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
