// Why: the SEO agent's card. Findable on purpose, honestly, and only when the switch says so.
import { defineAgentCard } from '@roadbook/core';
import { optionalStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'seo',
  phase: 5,
  reads: ['structure.md', 'versions/*.md', 'settings.yml → publishing.index', 'the built site'],
  writes: ['seo.md', 'pull requests to site/ when a page lacks its metadata'],
  purpose: 'Check that each page says what it is the way search and answer engines read it.',
  why: 'Private by default, public by decision; when public, a page should be as readable to a machine as to a child.',
  inputs: [
    { name: 'structure', type: 'markdown' },
    { name: 'versions', type: 'markdown' },
  ],
  outputs: [{ name: 'checklist', type: 'markdown' }],
  mustNot: [
    'Propose keyword stuffing, hidden text or a title that promises what the post does not say.',
    'Change anything when the index switch is off.',
  ],
  doneMeans: [
    { id: 'title', says: 'The proposed title is under 60 characters.' },
    { id: 'description', says: 'The proposed description is under 155 characters.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.9 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.03, secondsPerRun: 45 },
  behaviour: optionalStep(),
  metrics: standardMetrics(0.9, 0.03),
  data: { sends: ['text', 'metadata'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
