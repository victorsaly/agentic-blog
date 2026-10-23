// Why: the two rules the runner enforces — never under origin/, never without a why — are the ones that
// would do the most damage if they silently stopped working.
import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasWhy, markdownFile, writeOutputs } from './files.js';

const good = markdownFile(
  { why: 'This exists so the test has a file that passes every rule.', kind: 'short' },
  'Body',
);

describe('markdownFile', () => {
  it('puts the why first in the front matter', () => {
    expect(good.startsWith('---\nwhy:')).toBe(true);
    expect(hasWhy(good)).toBe(true);
  });
});

const at = (dir: string) => ({
  thought: dir,
  repo: join(dir, 'repo'),
  fallback: 'thought' as const,
});

describe('writeOutputs', () => {
  it('writes a good file and returns its path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    const written = await writeOutputs(at(dir), [{ path: 'versions/short.md', content: good }]);
    expect(written).toEqual(['versions/short.md']);
    expect(await readFile(join(dir, 'versions/short.md'), 'utf8')).toBe(good);
  });

  it('refuses to write under origin/', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    await expect(
      writeOutputs(at(dir), [{ path: 'origin/transcript.md', content: good }]),
    ).rejects.toThrow(/origins are never edited/);
  });

  it('refuses a file without a why', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    await expect(
      writeOutputs(at(dir), [
        { path: 'versions/short.md', content: '---\nkind: short\n---\nBody' },
      ]),
    ).rejects.toThrow(/no why/);
  });

  it('writes bytes for a picture, and refuses bytes for Markdown', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    const bytes = new Uint8Array([137, 80, 78, 71]);
    await writeOutputs(at(dir), [{ path: 'image/picture.png', content: '', bytes }]);
    expect(new Uint8Array(await readFile(join(dir, 'image/picture.png')))).toEqual(bytes);
    await expect(
      writeOutputs(at(dir), [{ path: 'image/prompt.md', content: '', bytes }]),
    ).rejects.toThrow(/must be text with a why/);
  });

  it('writes to the repo when a file asks for it, and never climbs out', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    const written = await writeOutputs(at(dir), [
      { path: 'profile.md', content: good, base: 'repo' },
    ]);
    expect(written).toEqual(['repo:profile.md']);
    expect(await readFile(join(dir, 'repo', 'profile.md'), 'utf8')).toBe(good);
    await expect(writeOutputs(at(dir), [{ path: '../escape.md', content: good }])).rejects.toThrow(
      /stay inside/,
    );
  });
});

describe('writeOutputs remove', () => {
  it('deletes a file the agent wrote before', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    const at2 = { thought: dir, repo: dir, fallback: 'thought' as const };
    await writeOutputs(at2, [{ path: 'image/old.png', content: '', bytes: new Uint8Array([1]) }]);
    const written = await writeOutputs(at2, [{ path: 'image/old.png', content: '', remove: true }]);
    expect(written).toEqual(['removed image/old.png']);
    await expect(readFile(join(dir, 'image/old.png'))).rejects.toThrow();
  });
});
