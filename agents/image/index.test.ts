// Why: the picture names and the section list decide what the reader sees beside each part of the post;
// a wrong order or an unsafe name would put the wrong drawing in the wrong place.
import { describe, expect, it } from 'vitest';
import { drawingPrompt, fileNameFor, sectionsOf, verifiedQuote } from './index.js';

describe('sectionsOf', () => {
  it('lists the sections of the long version, without the notes on what changed', () => {
    const long =
      '# Title\n\n## We hide the work\n\ntext\n\n## My advice\n\n## What changed from the origin, and why\n';
    expect(sectionsOf(long)).toEqual(['We hide the work', 'My advice']);
  });

  it('is empty when there is no long version', () => {
    expect(sectionsOf(undefined)).toEqual([]);
  });
});

describe('fileNameFor', () => {
  it('numbers the cover 00 and names the file after what it shows', () => {
    expect(fileNameFor(0, 'Person thinking at desk')).toBe('image/00-person-thinking-at-desk.png');
    expect(fileNameFor(3, 'Hands, hiding a laptop screen!')).toBe(
      'image/03-hands-hiding-a-laptop-screen.png',
    );
  });

  it('never produces a path outside image/', () => {
    expect(fileNameFor(1, '../../etc')).toBe('image/01-etc.png');
  });
});

describe('verifiedQuote', () => {
  const long = 'The one who makes the decision is still the human, at least in the current world.';

  it('keeps a sentence that is really in the text, whatever its quote marks', () => {
    expect(verifiedQuote('The one who makes the decision is still the human', long)).toBe(
      'The one who makes the decision is still the human',
    );
  });

  it('drops a quote the model made up or reworded', () => {
    expect(verifiedQuote('Humans always make the final decision', long)).toBeNull();
    expect(verifiedQuote('the human', long)).toBeNull();
    expect(verifiedQuote(undefined, long)).toBeNull();
  });
});

describe('drawingPrompt', () => {
  it('puts the house style first, then the recurring person, then the scene', () => {
    expect(drawingPrompt('Ink on white.', 'Short dark hair.', 'A hand circles one line.')).toBe(
      'Ink on white. If a person appears, it is always this person: Short dark hair. A hand circles one line. Generous empty space, nothing else. Square image.',
    );
  });
});
