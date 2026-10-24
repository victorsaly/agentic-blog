// Why: the drawing model gets the gist right and the details wrong: a person without a head, a laptop
// worn on someone's back, a logo it was told not to draw. Nothing caught that, so a broken drawing could
// reach the post. Claude looks at every drawing against what it was meant to show, and only a drawing that
// passes is kept.
import { unfence } from '../_lib/claude.js';
import type { AgentContext } from '../_lib/types.js';

export interface Review {
  ok: boolean;
  problems: string[];
}

const CHECKS = `You are checking one black-ink line drawing before it goes on a blog post. Look at the picture itself, not at what it was meant to be.

Fail it only for a real defect a reader would notice at a glance:
- A person is missing a head, or has a missing, extra or merged arm or leg.
- A hand or arm floats with no body attached, unless the subject is about hands only.
- An object is physically impossible: a laptop worn on a back, a desk that cannot stand, a pen held in two places.
- Any logo, brand mark, letters, numbers or readable text appears, including on devices.
- Large solid black shapes that are not part of the scene.
- The main subject cannot be recognised at all.

Do not fail it for small differences from the subject: an open lid instead of a closed one, a different expression, one object fewer, people seated a little differently. Note those instead.

Reply with JSON only, no other words: {"ok": true or false, "problems": ["one short sentence per defect"], "notes": ["one short sentence per small difference"]}. When ok is true, problems is empty.`;

/** Reads the verdict; anything that is not clearly ok counts as a failure. */
export function parseReview(reply: string): Review {
  const text = unfence(reply);
  const json = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!json) return { ok: false, problems: ['the reviewer did not return a verdict'] };
  try {
    const data = JSON.parse(json) as { ok?: unknown; problems?: unknown };
    const problems = Array.isArray(data.problems)
      ? data.problems.filter((p): p is string => typeof p === 'string')
      : [];
    return { ok: data.ok === true && problems.length === 0, problems };
  } catch {
    return { ok: false, problems: ['the reviewer verdict was not valid JSON'] };
  }
}

export async function reviewDrawing(
  ctx: AgentContext,
  png: Uint8Array,
  subject: string,
): Promise<Review> {
  const reply = await ctx.ask(`${CHECKS}\n\nThe subject: ${subject}`, {
    images: [png],
    maxOutputTokens: 1000,
  });
  return parseReview(reply);
}
