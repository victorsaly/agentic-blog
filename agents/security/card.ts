// Why: the security guard's card. It holds anything that would carry someone else's data out of the repo.
import { defineAgentCard } from '@roadbook/core';
import { guardStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'security',
  phase: 5,
  reads: [
    'package-lock.json',
    'npm audit and GitHub advisories',
    'versions/*.md',
    'image/',
    'sources.md',
  ],
  writes: ['security.md', 'dependency update pull requests'],
  purpose:
    'Check what is about to leave for other people’s data, secrets and internal links, and hold it if found.',
  why: 'A friend’s name, a face or an email must not leave until the blogger has confirmed it should.',
  inputs: [
    { name: 'versions', type: 'markdown' },
    { name: 'sources', type: 'markdown', optional: true },
  ],
  outputs: [
    {
      name: 'verdict',
      type: 'markdown',
      limit: 'pass, or hold with the text quoted and the kind of data',
    },
  ],
  mustNot: [
    'Redact or rewrite the text itself; the blogger decides what is theirs to share.',
    'Send a secret it finds anywhere, including into its own report.',
    'Record a decision for the blogger, or release a passage he has not kept word for word.',
  ],
  doneMeans: [
    { id: 'verdict', says: 'The verdict is exactly pass or hold.' },
    { id: 'kind', says: 'Every hold names the kind of data and the rule it breaks.' },
    {
      id: 'kept',
      says: 'A passage the blogger kept is not held again; anything outside it is, and his decision is carried into the new file.',
    },
  ],
  qualityBar: { approvedWithoutRewrite: 0.95 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.05, secondsPerRun: 60 },
  behaviour: guardStep(),
  metrics: standardMetrics(0.95, 0.05),
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.1.0',
  stage: 'active',
});
