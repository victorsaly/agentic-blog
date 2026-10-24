// Why: a drawing is costed from the usage OpenAI reports, so a reply with that usage missing or half there
// must stop the run rather than go into the ledger as free.
import { describe, expect, it } from 'vitest';
import { imageUsage } from './openai-images.js';

describe('imageUsage', () => {
  it('reads the prompt, the reference photo and the picture', () => {
    expect(
      imageUsage({
        usage: {
          input_tokens: 300,
          output_tokens: 1756,
          input_tokens_details: { text_tokens: 23, image_tokens: 277 },
        },
      }),
    ).toEqual({ inputTokens: 23, imageInputTokens: 277, imageOutputTokens: 1756 });
  });

  it('counts every input token as the prompt when there is no split', () => {
    expect(imageUsage({ usage: { input_tokens: 23, output_tokens: 1756 } })).toEqual({
      inputTokens: 23,
      imageInputTokens: 0,
      imageOutputTokens: 1756,
    });
  });

  it('refuses usage that is missing, partial or not a count', () => {
    expect(imageUsage({})).toBeNull();
    expect(imageUsage({ usage: {} })).toBeNull();
    expect(imageUsage({ usage: { input_tokens: 23 } })).toBeNull();
    expect(imageUsage({ usage: { input_tokens: -1, output_tokens: 10 } })).toBeNull();
    expect(imageUsage({ usage: { input_tokens: 23, output_tokens: Infinity } })).toBeNull();
    expect(
      imageUsage({
        usage: {
          input_tokens: 300,
          output_tokens: 10,
          input_tokens_details: { image_tokens: 277 },
        },
      }),
    ).toBeNull();
    expect(
      imageUsage({ usage: { input_tokens: 300, output_tokens: 10, input_tokens_details: {} } }),
    ).toBeNull();
  });
});
