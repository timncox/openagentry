/**
 * Minimal line-buffered SSE parser. Emits `data` events for the content
 * after `data: ` prefixes, or a `done` event when the OpenAI sentinel
 * `data: [DONE]` is seen. All other SSE fields (event:, id:, retry:) and
 * comment lines (starting with `:`) are skipped.
 *
 * Boundary cases handled: split mid-line across chunks, multiple events
 * per chunk, blank-line separator (`\n\n`), `\r\n` line endings, trailing
 * data line without final blank separator.
 *
 * @module
 */

export type SseEvent =
  | { kind: 'data'; data: string }
  | { kind: 'done' };

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let dataLines: string[] = [];

  const flushEvent = (): SseEvent | undefined => {
    if (dataLines.length === 0) return undefined;
    const data = dataLines.join('\n');
    dataLines = [];
    if (data === '[DONE]') return { kind: 'done' };
    return { kind: 'data', data };
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        let line = buffer.slice(0, nl);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        buffer = buffer.slice(nl + 1);

        if (line === '') {
          // blank-line separator — flush event
          const ev = flushEvent();
          if (ev !== undefined) yield ev;
        } else if (line.startsWith(':')) {
          // comment line; ignore
        } else if (line.startsWith('data:')) {
          // strip "data:" + optional single space (per SSE spec)
          dataLines.push(line.slice(5).replace(/^ /, ''));
        } else {
          // other fields (event:, id:, retry:) — ignore for our use case
        }
        nl = buffer.indexOf('\n');
      }
    }

    // flush any remaining decoder bytes
    buffer += decoder.decode();
    if (buffer.length > 0) {
      let line = buffer;
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
    }
    const ev = flushEvent();
    if (ev !== undefined) yield ev;
  } finally {
    reader.releaseLock();
  }
}
