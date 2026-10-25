// Why: while Victor talks, the studio shows what it hears, so he can tell he is understood before he stops.
// Nova-3 sends a guess for the words it is still hearing, replaced as it hears more, and then the words it
// is sure of, to keep. This turns its messages into the two parts the page draws: what is kept, and the
// guess after it. Pure and narrowed from unknown, so a change in what Nova-3 sends shows up in a test.

export interface LiveWords {
  /** Words Nova-3 is sure of, in order. */
  kept: string;
  /** Its guess at what is being said now; replaced by each new guess, emptied once kept. */
  guess: string;
}

export const noWords: LiveWords = { kept: '', guess: '' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** What one message from Nova-3 adds. Anything that is not a result (metadata, a closing word) changes nothing. */
export function heard(words: LiveWords, message: unknown): LiveWords {
  if (!isRecord(message) || message.type !== 'Results' || !isRecord(message.channel)) return words;
  const alternatives = message.channel.alternatives;
  const first: unknown = Array.isArray(alternatives) ? alternatives[0] : null;
  const transcript =
    isRecord(first) && typeof first.transcript === 'string' ? first.transcript : '';
  if (message.is_final !== true) return { ...words, guess: transcript };
  if (transcript.trim() === '') return { ...words, guess: '' };
  return { kept: words.kept === '' ? transcript : `${words.kept} ${transcript}`, guess: '' };
}
