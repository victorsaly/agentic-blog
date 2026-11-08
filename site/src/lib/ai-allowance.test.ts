// Why: a recording that cannot be written down because the free allowance ran out must say that, and when
// it comes back, not show a bare server error; any other failure must not be mistaken for it.
import { describe, expect, it } from 'vitest';
import { allowanceMessage, hoursUntilReset, isAllowanceUsedUp } from './ai-allowance';

describe('the free Workers AI allowance', () => {
  it('knows the allowance error and nothing else', () => {
    expect(
      isAllowanceUsedUp(
        new Error(
          "4006: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan if you would like to continue usage.",
        ),
      ),
    ).toBe(true);
    expect(isAllowanceUsedUp(new Error('5006: the model timed out'))).toBe(false);
    expect(isAllowanceUsedUp('network down')).toBe(false);
  });

  it('says when it comes back, counting to midnight UTC', () => {
    expect(hoursUntilReset(new Date('2026-11-07T14:20:33Z'))).toBe(10);
    expect(hoursUntilReset(new Date('2026-11-07T23:59:00Z'))).toBe(1);
    expect(allowanceMessage(new Date('2026-11-07T23:30:00Z'))).toContain('in about 1 hour;');
    expect(allowanceMessage(new Date('2026-11-07T14:20:33Z'))).toContain('in about 10 hours;');
  });
});
