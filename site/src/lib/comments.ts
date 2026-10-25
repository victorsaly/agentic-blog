// Why: readers may leave a comment under any post, and other readers see it once Victor has approved it.
// These pure functions hold the rules: what a valid comment is, what a reader may be shown (never an email),
// and how each reply is read back on the page. They are tested without a network, so the rules hold
// whatever the edge function or the browser sends.

export const MAX_NAME = 60;
export const MAX_BODY = 2000;
export const MAX_EMAIL = 254;
/** A comment with more links than this is almost always spam, and a real one rarely needs them. */
export const MAX_LINKS = 2;
/** The request is small text; anything bigger than this is refused before it is read. */
export const MAX_REQUEST_BYTES = 8 * 1024;
/** How many comments one page of a list holds, for readers and for the studio. */
export const PAGE_SIZE = 50;

export interface NewComment {
  name: string;
  /** Only Victor ever sees this; null when the reader left it out. */
  email: string | null;
  body: string;
  /** The Turnstile answer that says a person filled the form in. */
  token: string;
  /** True when the hidden field only a bot fills was filled; the comment is then dropped without a word. */
  trap: boolean;
}

export type ParsedComment = { ok: true; value: NewComment } | { ok: false; error: string };

/** What every reader may see of a comment. */
export interface PublicComment {
  id: number;
  name: string;
  body: string;
  createdAt: string;
}

/** What only Victor sees, in the studio. */
export interface OwnerComment extends PublicComment {
  slug: string;
  email: string | null;
  status: CommentStatus;
}

export type CommentStatus = 'pending' | 'approved';

const THOUGHT = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINK = /https?:\/\/|www\./gi;
// Control characters other than tab and newline have no place in a name or a comment.

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function isThoughtSlug(value: unknown): value is string {
  return typeof value === 'string' && THOUGHT.test(value);
}

function field(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)[name]
    : undefined;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(CONTROL, '') : '';
}

/** One line: runs of whitespace become one space. */
function oneLine(value: unknown): string {
  return text(value).replace(/\s+/g, ' ').trim();
}

/** Paragraphs kept, but never more than one empty line in a row. */
function paragraphs(value: unknown): string {
  return text(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseCommentRequest(body: unknown): ParsedComment {
  const name = oneLine(field(body, 'name'));
  const email = oneLine(field(body, 'email'));
  const comment = paragraphs(field(body, 'body'));
  const token = oneLine(field(body, 'token'));
  const trap = oneLine(field(body, 'website')) !== '';

  if (name === '') return { ok: false, error: 'Add a name, any name you like.' };
  if (name.length > MAX_NAME)
    return { ok: false, error: `The name is longer than ${String(MAX_NAME)} characters.` };
  if (email !== '' && (email.length > MAX_EMAIL || !EMAIL.test(email)))
    return { ok: false, error: 'That email does not look right. Leave it out if you prefer.' };
  if (comment === '') return { ok: false, error: 'Write a comment first.' };
  if (comment.length > MAX_BODY)
    return {
      ok: false,
      error: `The comment is longer than ${String(MAX_BODY)} characters. Shorten it a little.`,
    };
  if ((comment.match(LINK) ?? []).length > MAX_LINKS)
    return { ok: false, error: `Please keep links to ${String(MAX_LINKS)} or fewer.` };

  return {
    ok: true,
    value: { name, email: email === '' ? null : email, body: comment, token, trap },
  };
}

/** Which list the studio asks for. Anything else means the ones waiting. */
export function parseStatus(value: string | null): CommentStatus {
  return value === 'approved' ? 'approved' : 'pending';
}

/** A row id from a URL: a positive whole number, or null. */
export function parseId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null;
  return Number(value);
}

/** A page cursor from a URL: absent means "from the start" (null), a bad one is undefined. */
export function parseCursor(value: string | null): number | null | undefined {
  return value === null ? null : (parseId(value) ?? undefined);
}

/**
 * Rows fetched one past the page size become one page, plus the cursor for the next one (the id of its last
 * row), or null when nothing more is waiting.
 */
export function pageOf<T extends { id: number }>(
  rows: T[],
  size: number,
): { rows: T[]; next: number | null } {
  if (rows.length <= size) return { rows, next: null };
  const kept = rows.slice(0, size);
  return { rows: kept, next: kept.at(-1)?.id ?? null };
}

/** Comments already on the page first, then any new ones, none twice. */
export function mergeById<T extends { id: number }>(seen: T[], more: T[]): T[] {
  const ids = new Set(seen.map((item) => item.id));
  return [...seen, ...more.filter((item) => !ids.has(item.id))];
}

/** The studio's only decision is to approve; a refusal is a deletion. */
export function isApproval(body: unknown): boolean {
  return field(body, 'action') === 'approve';
}

function isPublic(row: unknown): row is PublicComment {
  if (typeof row !== 'object' || row === null) return false;
  const { id, name, body, createdAt } = row as Record<string, unknown>;
  return (
    typeof id === 'number' &&
    typeof name === 'string' &&
    typeof body === 'string' &&
    typeof createdAt === 'string'
  );
}

function readNext(data: unknown): number | null {
  const next = field(data, 'next');
  return typeof next === 'number' && Number.isInteger(next) && next > 0 ? next : null;
}

export interface CommentsReply {
  comments: PublicComment[];
  /** Turnstile's public key; null means this deployment is not set up to take comments. */
  siteKey: string | null;
  /** Where the next page starts; null when this was the last one. */
  next: number | null;
}

/** The page's read of the public list: whatever is not a well-formed comment is left out. */
export function readCommentsReply(data: unknown): CommentsReply {
  const rows = field(data, 'comments');
  const siteKey = field(data, 'siteKey');
  return {
    comments: Array.isArray(rows) ? rows.filter(isPublic) : [],
    siteKey: typeof siteKey === 'string' && siteKey !== '' ? siteKey : null,
    next: readNext(data),
  };
}

function isOwner(row: unknown): row is OwnerComment {
  if (!isPublic(row)) return false;
  const { slug, email, status } = row as unknown as Record<string, unknown>;
  return (
    typeof slug === 'string' &&
    (email === null || typeof email === 'string') &&
    (status === 'pending' || status === 'approved')
  );
}

/** The studio's read of one page of its list. */
export function readOwnerPage(data: unknown): { comments: OwnerComment[]; next: number | null } {
  const rows = field(data, 'comments');
  return { comments: Array.isArray(rows) ? rows.filter(isOwner) : [], next: readNext(data) };
}

/** A row from D1 as the public may see it. The email is dropped here, in one place. */
export function toPublic(row: {
  id: number;
  name: string;
  body: string;
  created_at: string;
}): PublicComment {
  return { id: row.id, name: row.name, body: row.body, createdAt: row.created_at };
}

export function toOwner(row: {
  id: number;
  slug: string;
  name: string;
  email: string | null;
  body: string;
  status: string;
  created_at: string;
}): OwnerComment {
  return {
    ...toPublic(row),
    slug: row.slug,
    email: row.email,
    status: row.status === 'approved' ? 'approved' : 'pending',
  };
}
