// Why: the check that a person filled the form in must fail closed; if Cloudflare cannot be asked, the
// comment is not let through.
import { describe, expect, it } from 'vitest';
import { verifyTurnstile } from './turnstile';

function answer(body: unknown, ok = true): typeof fetch {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));
}

describe('verifyTurnstile', () => {
  it('passes when Cloudflare says success', async () => {
    expect(
      await verifyTurnstile({
        secret: 's',
        token: 't',
        ip: '1.1.1.1',
        fetcher: answer({ success: true }),
      }),
    ).toBe(true);
  });

  it('fails when Cloudflare says no', async () => {
    expect(
      await verifyTurnstile({
        secret: 's',
        token: 't',
        ip: null,
        fetcher: answer({ success: false }),
      }),
    ).toBe(false);
  });

  it('fails without a token, without asking', async () => {
    let asked = false;
    const fetcher: typeof fetch = () => {
      asked = true;
      return Promise.resolve(new Response('{}'));
    };
    expect(await verifyTurnstile({ secret: 's', token: '', ip: null, fetcher })).toBe(false);
    expect(asked).toBe(false);
  });

  it('fails when Cloudflare cannot be reached or answers badly', async () => {
    const broken: typeof fetch = () => Promise.reject(new Error('offline'));
    expect(await verifyTurnstile({ secret: 's', token: 't', ip: null, fetcher: broken })).toBe(
      false,
    );
    expect(
      await verifyTurnstile({
        secret: 's',
        token: 't',
        ip: null,
        fetcher: answer({ success: true }, false),
      }),
    ).toBe(false);
    expect(
      await verifyTurnstile({ secret: 's', token: 't', ip: null, fetcher: answer('nope') }),
    ).toBe(false);
  });

  it('sends the secret, the answer and the address', async () => {
    let sent = '';
    const fetcher: typeof fetch = (_url, init) => {
      sent = init?.body instanceof URLSearchParams ? init.body.toString() : '';
      return Promise.resolve(new Response('{"success":true}'));
    };
    await verifyTurnstile({ secret: 'sec', token: 'tok', ip: '9.9.9.9', fetcher });
    expect(sent).toContain('secret=sec');
    expect(sent).toContain('response=tok');
    expect(sent).toContain('remoteip=9.9.9.9');
  });
});
