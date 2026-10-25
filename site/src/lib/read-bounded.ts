// Why: a visitor can send a request of any size before the site knows who they are. This reads the body as it
// arrives, counts real bytes, and stops at the limit instead of holding the whole thing in memory first.

/** The body as text, or null when it is longer than `max` bytes (reading stops there). */
export async function readBoundedText(
  request: { body: ReadableStream<Uint8Array> | null },
  max: number,
): Promise<string | null> {
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > max) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
