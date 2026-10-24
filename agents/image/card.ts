// Why: the image agent's card. One picture style, the same hand every time, and no picture rather than
// the wrong one.
import { defineAgentCard } from '@roadbook/core';
import { coreStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'image',
  phase: 4,
  reads: ['structure.md', 'settings.yml → media.image_style', 'profile.md'],
  writes: ['image/prompts.md', 'image/NN-<what-it-shows>.png'],
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
  behaviour: {
    ...coreStep(false),
    retry: {
      max: 2,
      backoffSeconds: 30,
      withFeedback: true,
      on: ['check-failed', 'provider-error', 'timeout'],
    },
    onFailure: 'use-fallback',
    fallback: 'workers',
  },
  metrics: standardMetrics(0.7, 0.6),
  variables: {
    maxPrints: {
      type: 'number',
      default: 6,
      why: 'A cover and one print per section that earns one, never more than this.',
    },
  },
  // OpenAI gets the prompt and, on Victor's machine only, his reference photo; the Workers AI fallback takes
  // the prompt alone (agents/_lib/workers-ai.ts).
  data: { sends: ['prompt', 'image'], fallbackSends: ['prompt'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
