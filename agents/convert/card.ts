// Why: the convert agent's card. Same core, different shape, and none of the shapes may pretend to be
// the origin.
import { defineAgentCard } from '@roadbook/core';

export const card = defineAgentCard({
  name: 'convert',
  purpose: 'Write each version a reader might take in: short, long, a social post, another language.',
  why: 'One honest minute of talking should reach a reader in whatever form they take in best.',
  inputs: [
    { name: 'structure', type: 'markdown' },
    { name: 'origin', type: 'markdown' },
    { name: 'profile', type: 'markdown' },
  ],
  outputs: [
    { name: 'short', type: 'markdown', limit: 'under 250 words' },
    { name: 'long', type: 'markdown', limit: 'ends with what changed from the origin, and why' },
    { name: 'linkedin', type: 'markdown', limit: 'under 180 words, no hashtags, no emoji' },
  ],
  mustNot: [
    'Add facts the blogger did not say.',
    'Smooth away the blogger’s own words and odd prepositions.',
    'Leave out the section on what changed from the origin in the long version.',
  ],
  doneMeans: [
    { id: 'short-length', says: 'The short version is under 250 words.' },
    { id: 'changes-listed', says: 'The long version ends with what changed from the origin, and why.' },
    { id: 'converted-from', says: 'Every version names the origin it was converted from.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.75 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.25, secondsPerRun: 180 },
  gateAfter: false,
  data: { sends: ['text', 'metadata'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
