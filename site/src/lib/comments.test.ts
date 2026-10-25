// Why: the comment rules are what keep a spam bot, a script tag or someone else's email out of the page,
// so each rule has a test that names it.
import { describe, expect, it } from 'vitest';
import {
  MAX_BODY,
  MAX_LINKS,
  MAX_NAME,
  isApproval,
  isThoughtSlug,
  parseCommentRequest,
  parseId,
  parseStatus,
  readCommentsReply,
  readOwnerComments,
  toOwner,
  toPublic,
} from './comments';

const good = {
  name: 'Ada',
  email: 'ada@example.com',
  body: 'Lovely post.',
  token: 'tok',
  website: '',
};

describe('parseCommentRequest', () => {
  it('accepts a name, an email and a comment', () => {
    expect(parseCommentRequest(good)).toEqual({
      ok: true,
      value: {
        name: 'Ada',
        email: 'ada@example.com',
        body: 'Lovely post.',
        token: 'tok',
        trap: false,
      },
    });
  });

  it('treats the email as optional', () => {
    const parsed = parseCommentRequest({ ...good, email: '   ' });
    expect(parsed.ok && parsed.value.email).toBeNull();
    const missing = parseCommentRequest({ name: 'Ada', body: 'Hi', token: 't' });
    expect(missing.ok && missing.value.email).toBeNull();
  });

  it('refuses an empty name or comment', () => {
    expect(parseCommentRequest({ ...good, name: '  ' }).ok).toBe(false);
    expect(parseCommentRequest({ ...good, body: '\n ' }).ok).toBe(false);
  });

  it('refuses a name or comment that is too long', () => {
    expect(parseCommentRequest({ ...good, name: 'a'.repeat(MAX_NAME + 1) }).ok).toBe(false);
    expect(parseCommentRequest({ ...good, body: 'a'.repeat(MAX_BODY + 1) }).ok).toBe(false);
    expect(parseCommentRequest({ ...good, body: 'a'.repeat(MAX_BODY) }).ok).toBe(true);
  });

  it('refuses an email that does not look like one', () => {
    expect(parseCommentRequest({ ...good, email: 'not-an-email' }).ok).toBe(false);
    expect(parseCommentRequest({ ...good, email: 'a b@c.d' }).ok).toBe(false);
  });

  it('refuses too many links', () => {
    const links = Array.from(
      { length: MAX_LINKS + 1 },
      (_, i) => `https://a${String(i)}.example`,
    ).join(' ');
    expect(parseCommentRequest({ ...good, body: links }).ok).toBe(false);
    expect(parseCommentRequest({ ...good, body: 'see https://a.example' }).ok).toBe(true);
  });

  it('flags a filled honeypot', () => {
    const parsed = parseCommentRequest({ ...good, website: 'http://spam.example' });
    expect(parsed.ok && parsed.value.trap).toBe(true);
  });

  it('keeps markup as plain text, untouched', () => {
    const parsed = parseCommentRequest({ ...good, body: '<script>alert(1)</script>' });
    expect(parsed.ok && parsed.value.body).toBe('<script>alert(1)</script>');
  });

  it('keeps paragraphs but collapses long gaps, and strips control characters', () => {
    const parsed = parseCommentRequest({ ...good, body: 'one\r\n\r\n\r\n\r\ntwo\u0000' });
    expect(parsed.ok && parsed.value.body).toBe('one\n\ntwo');
  });

  it('puts a name on one line', () => {
    const parsed = parseCommentRequest({ ...good, name: 'Ada\n  Lovelace' });
    expect(parsed.ok && parsed.value.name).toBe('Ada Lovelace');
  });

  it('survives a body that is not an object', () => {
    expect(parseCommentRequest(null).ok).toBe(false);
    expect(parseCommentRequest('hello').ok).toBe(false);
    expect(parseCommentRequest({ name: 5, body: [] }).ok).toBe(false);
  });
});

describe('small parsers', () => {
  it('accepts only a dated thought folder name', () => {
    expect(isThoughtSlug('2026-10-23-talked-out-loud-tidied-by-ai')).toBe(true);
    expect(isThoughtSlug('../etc/passwd')).toBe(false);
    expect(isThoughtSlug(undefined)).toBe(false);
  });

  it('reads a status, defaulting to pending', () => {
    expect(parseStatus('approved')).toBe('approved');
    expect(parseStatus('anything')).toBe('pending');
    expect(parseStatus(null)).toBe('pending');
  });

  it('reads a row id', () => {
    expect(parseId('12')).toBe(12);
    expect(parseId('0')).toBeNull();
    expect(parseId('1; drop table comments')).toBeNull();
    expect(parseId(undefined)).toBeNull();
  });

  it('knows an approval', () => {
    expect(isApproval({ action: 'approve' })).toBe(true);
    expect(isApproval({ action: 'delete' })).toBe(false);
    expect(isApproval(null)).toBe(false);
  });
});

describe('what a reader may see', () => {
  const row = {
    id: 3,
    slug: '2026-10-23-x',
    name: 'Ada',
    email: 'ada@example.com',
    body: 'Hello',
    status: 'approved',
    created_at: '2026-10-25T10:00:00Z',
  };

  it('never carries the email', () => {
    const shown = toPublic(row);
    expect(shown).toEqual({ id: 3, name: 'Ada', body: 'Hello', createdAt: '2026-10-25T10:00:00Z' });
    expect(JSON.stringify(shown)).not.toContain('ada@example.com');
  });

  it('gives the owner the email and the state', () => {
    expect(toOwner(row)).toMatchObject({
      email: 'ada@example.com',
      status: 'approved',
      slug: '2026-10-23-x',
    });
    expect(toOwner({ ...row, status: 'weird' }).status).toBe('pending');
  });

  it('reads a public reply and drops malformed rows', () => {
    const reply = readCommentsReply({
      siteKey: 'abc',
      comments: [{ id: 1, name: 'A', body: 'B', createdAt: 'now' }, { id: 'x' }, null],
    });
    expect(reply.siteKey).toBe('abc');
    expect(reply.comments).toHaveLength(1);
    expect(readCommentsReply(null)).toEqual({ comments: [], siteKey: null });
    expect(readCommentsReply({ siteKey: '' }).siteKey).toBeNull();
  });

  it('reads the owner list and drops malformed rows', () => {
    const rows = readOwnerComments({
      comments: [
        {
          id: 1,
          name: 'A',
          body: 'B',
          createdAt: 'now',
          slug: 's',
          email: null,
          status: 'pending',
        },
        { id: 2, name: 'A', body: 'B', createdAt: 'now', slug: 's', email: null, status: 'nope' },
      ],
    });
    expect(rows).toHaveLength(1);
  });
});
