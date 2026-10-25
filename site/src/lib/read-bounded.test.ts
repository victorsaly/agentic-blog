import { describe, expect, it } from 'vitest';
import { readBoundedText } from './read-bounded';

function post(body: BodyInit | null): Request {
  return new Request('https://example.test/', { method: 'POST', body });
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[sent];
      sent += 1;
      if (chunk === undefined) controller.close();
      else controller.enqueue(chunk);
    },
  });
}

describe('readBoundedText', () => {
  it('reads a body that fits', async () => {
    expect(await readBoundedText(post('{"a":1}'), 100)).toBe('{"a":1}');
  });

  it('reads an empty request as empty text', async () => {
    expect(await readBoundedText(post(null), 100)).toBe('');
  });

  it('refuses a body over the limit', async () => {
    expect(await readBoundedText(post('x'.repeat(101)), 100)).toBeNull();
  });

  it('counts bytes, not characters', async () => {
    expect(await readBoundedText(post('é'.repeat(60)), 100)).toBeNull();
    expect(await readBoundedText(post('é'.repeat(50)), 100)).toBe('é'.repeat(50));
  });

  it('stops reading as soon as the limit is passed', async () => {
    let pulled = 0;
    const chunk = new TextEncoder().encode('x'.repeat(40));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    expect(await readBoundedText({ body }, 100)).toBeNull();
    expect(pulled).toBeLessThan(6);
  });

  it('keeps a character that is split across chunks', async () => {
    const bytes = new TextEncoder().encode('é');
    const body = streamOf([bytes.slice(0, 1), bytes.slice(1)]);
    expect(await readBoundedText({ body }, 100)).toBe('é');
  });
});
