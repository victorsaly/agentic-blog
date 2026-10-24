// Why: the image agent's card. One picture style, the same hand every time, and no picture rather than
// the wrong one.
import { defineAgentCard } from '@roadbook/core';

export const card = defineAgentCard({
  name: 'image',
  purpose: 'Draw one linocut print per section that earns one, in the house style.',
  why: 'A picture carries the mood; continuity of style keeps every post recognisably the same person’s.',
  inputs: [
    { name: 'structure', type: 'markdown' },
    { name: 'image style', type: 'text' },
  ],
  outputs: [
    { name: 'prompts', type: 'markdown' },
    { name: 'prints', type: 'image', limit: 'black and white only, no text, no logos' },
  ],
  mustNot: [
    'Put text, logos or brand marks in a picture.',
    'Draw a real person other than the blogger.',
    'Publish a picture the review step did not pass.',
  ],
  doneMeans: [
    { id: 'monochrome', says: 'Every print is pure black and white.' },
    { id: 'alt-text', says: 'Every print has alt text a screen reader can say.' },
    { id: 'reviewed', says: 'Every print was reviewed before it was listed as drawn.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.7 },
  model: { default: 'images', allowed: ['images', 'workers'] },
  budget: { usdPerRun: 0.6, secondsPerRun: 300 },
  gateAfter: false,
  data: { sends: ['prompt', 'image'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
