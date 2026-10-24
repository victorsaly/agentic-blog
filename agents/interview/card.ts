// Why: the interview agent's card: what it is for, what it may never do, and how its work is judged.
// The framework reads this; it is the instruction, not a description of it.
import { defineAgentCard } from '@roadbook/core';
import { coreStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'interview',
  purpose: 'Ask the few questions a stranger would need answered before the origin makes sense.',
  why: 'A raw note has the feeling and skips the facts; the context can only come from the blogger, and only while they remember.',
  inputs: [
    { name: 'origin', type: 'markdown' },
    { name: 'profile', type: 'markdown' },
  ],
  outputs: [{ name: 'questions', type: 'list', limit: '4 to 8 questions, one line each' }],
  mustNot: [
    'Write any part of the post; it only asks.',
    'Ask something the origin already answers.',
    'Ask about health, mood or anything the blogger did not raise.',
  ],
  doneMeans: [
    { id: 'count', says: 'Between four and eight questions.' },
    { id: 'not-answered', says: 'No question is answered by the origin itself.' },
    { id: 'one-line', says: 'Each question fits on one line.' },
  ],
  qualityBar: { approvedWithoutRewrite: 0.8 },
  model: { default: 'writer', allowed: ['writer'] },
  budget: { usdPerRun: 0.03, secondsPerRun: 45 },
  behaviour: coreStep(true),
  metrics: standardMetrics(0.8, 0.03),
  variables: {
    maxQuestions: {
      type: 'number',
      default: 8,
      why: 'How many questions at most; fewer is better when the note already says enough.',
    },
  },
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
