// Why: the structure agent's card. It decides shape, never content, and this card is where that promise
// becomes checkable.
import { defineAgentCard } from '@roadbook/core';

export const card = defineAgentCard({
  name: 'structure',
  purpose: 'Find the message, the idea and the small ideas in an origin, each tagged with its themes.',
  why: 'A voice note is rarely about one thing; a reader needs the point first and the graph needs the small ideas.',
  inputs: [
    { name: 'origin', type: 'markdown' },
    { name: 'answers', type: 'markdown', optional: true },
    { name: 'themes', type: 'list' },
  ],
  outputs: [
    { name: 'message', type: 'text', limit: 'at most 400 characters' },
    { name: 'idea', type: 'markdown', limit: 'at most 250 words' },
    { name: 'small ideas', type: 'list', limit: '3 to 15, each with at least one theme' },
  ],
  mustNot: [
    'Add a fact, example or number that is not in the origin or the answers.',
    'Finish a sentence the speaker cut off.',
    'Use a theme that is not in the settings.',
  ],
  doneMeans: [
    { id: 'message-length', says: 'The message is at most 400 characters.' },
    { id: 'idea-length', says: 'The idea is at most 250 words.' },
    { id: 'themes-known', says: 'Every small idea has at least one theme from the settings list.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.85 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.05, secondsPerRun: 60 },
  gateAfter: true,
  data: { sends: ['text', 'metadata'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
