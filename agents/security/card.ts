// Why: the security guard's card. It holds anything that would carry someone else's data out of the repo.
import { defineAgentCard } from '@roadbook/core';

export const card = defineAgentCard({
  name: 'security',
  purpose: 'Check what is about to leave for other people’s data, secrets and internal links, and hold it if found.',
  why: 'A friend’s name, a face or an email must not leave until the blogger has confirmed it should.',
  inputs: [
    { name: 'versions', type: 'markdown' },
    { name: 'sources', type: 'markdown', optional: true },
  ],
  outputs: [{ name: 'verdict', type: 'markdown', limit: 'pass, or hold with the text quoted and the kind of data' }],
  mustNot: [
    'Redact or rewrite the text itself; the blogger decides what is theirs to share.',
    'Send a secret it finds anywhere, including into its own report.',
  ],
  doneMeans: [
    { id: 'verdict', says: 'The verdict is exactly pass or hold.' },
    { id: 'kind', says: 'Every hold names the kind of data and the rule it breaks.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.95 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.05, secondsPerRun: 60 },
  gateAfter: false,
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
