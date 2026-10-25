// Why: the voice agent's cost is the character count this reads; it must take ElevenLabs' own figure when
// it is there and otherwise count what was sent, never zero.
import { describe, expect, it } from 'vitest';
import { billedCharacters } from './elevenlabs.js';

describe('billedCharacters', () => {
  it("takes ElevenLabs' reported count, and otherwise counts the characters sent", () => {
    expect(billedCharacters(new Headers({ 'character-cost': '512' }), 'ignored')).toBe(512);
    expect(billedCharacters(new Headers({ 'x-character-count': '40' }), 'ignored')).toBe(40);
    expect(billedCharacters(new Headers(), 'Read me — aloud')).toBe(15);
    expect(billedCharacters(new Headers({ 'character-cost': 'n/a' }), 'abc')).toBe(3);
  });
});
