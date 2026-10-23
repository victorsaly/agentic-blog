// Why: the two rules the runner enforces — never under origin/, never without a why — are the ones that
// would do the most damage if they silently stopped working.
import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasWhy, markdownFile, writeOutputs } from './files.js';

const good = markdownFile({ why: 'This exists so the test has a file that passes every rule.', kind: 'short' }, 'Body');

describe('markdownFile', () => {
  it('puts the why first in the front matter', () => {
    expect(good.startsWith('---\nwhy:')).toBe(true);
    expect(hasWhy(good)).toBe(true);
  });
});

describe('writeOutputs', () => {
  it('writes a good file and returns its path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    const written = await writeOutputs(dir, [{ path: 'versions/short.md', content: good }]);
    expect(written).toEqual(['versions/short.md']);
    expect(await readFile(join(dir, 'versions/short.md'), 'utf8')).toBe(good);
  });

  it('refuses to write under origin/', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    await expect(writeOutputs(dir, [{ path: 'origin/transcript.md', content: good }])).rejects.toThrow(/origins are never edited/);
  });

  it('refuses a file without a why', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-'));
    await expect(writeOutputs(dir, [{ path: 'versions/short.md', content: '---\nkind: short\n---\nBody' }])).rejects.toThrow(/no why/);
  });
});
