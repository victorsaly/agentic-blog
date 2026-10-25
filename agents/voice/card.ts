// Why: the voice agent's card. It reads the approved short version aloud, word for word, and says when each
// word is spoken; it never rewords, and it never spends on text that is held.
import { defineAgentCard } from '@roadbook/core';
import { optionalStep, standardMetrics } from '../_lib/card-presets.js';

export const card = defineAgentCard({
  name: 'voice',
  phase: 5,
  reads: [
    'versions/short.md',
    'safety.md',
    'security.md',
    'settings.yml → media.voice_id, voice_speed',
  ],
  writes: ['voice/short.mp3', 'voice/short.json', 'voice/short.md'],
  purpose:
    'Read the short version aloud in one steady voice and record when each word is spoken, so the page can follow along.',
  why: 'Some readers would rather listen, and a post that talks is closer to how it began: a voice note.',
  inputs: [
    { name: 'short version', type: 'markdown' },
    { name: 'safety verdict', type: 'markdown' },
    { name: 'security verdict', type: 'markdown' },
  ],
  outputs: [
    { name: 'speech', type: 'audio' },
    { name: 'word times', type: 'json' },
    { name: 'spoken text', type: 'markdown' },
  ],
  mustNot: [
    'Change, add or drop a word of the approved text to make it sound better.',
    'Speak text the safety or security guard has not passed, or whose verdict file is missing.',
    'Read a text longer than the card allows, or pay again for a text that has not changed.',
  ],
  doneMeans: [
    {
      id: 'same-words',
      says: 'The words timed in the audio are exactly the words of the spoken text, in order.',
    },
    { id: 'every-word-timed', says: 'Every spoken word has a start and an end in seconds.' },
    {
      id: 'listened',
      says: 'Victor listened to the audio before merging; it is marked reviewed only then.',
    },
  ],
  qualityBar: { approvedWithoutRewrite: 0.8 },
  model: { default: 'voices', allowed: ['voices'] },
  budget: { usdPerRun: 0.15, secondsPerRun: 120 },
  behaviour: optionalStep(),
  metrics: standardMetrics(0.8, 0.15),
  variables: {
    maxSpokenWords: {
      type: 'number',
      default: 400,
      why: 'The idea is one screen; a longer text is not an idea, and reading it costs real money.',
    },
  },
  data: { sends: ['text'] },
  owner: 'Victor Saly',
  version: '1.0.0',
  stage: 'active',
});
