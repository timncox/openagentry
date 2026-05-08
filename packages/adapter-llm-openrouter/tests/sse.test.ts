import { describe, it, expect } from 'vitest';
import { parseSseStream, type SseEvent } from '../src/sse.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function readableFrom(chunks: string[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(ctrl) {
      if (i < chunks.length) {
        ctrl.enqueue(enc(chunks[i]!));
        i++;
      } else {
        ctrl.close();
      }
    },
  });
}

async function collect(events: AsyncIterable<SseEvent>): Promise<SseEvent[]> {
  const out: SseEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

describe('sse — parseSseStream', () => {
  it('yields events for one chunk containing two complete events', async () => {
    const stream = readableFrom([
      'data: {"foo":1}\n\ndata: {"foo":2}\n\n',
    ]);
    const events = await collect(parseSseStream(stream));
    expect(events).toEqual([
      { kind: 'data', data: '{"foo":1}' },
      { kind: 'data', data: '{"foo":2}' },
    ]);
  });

  it('handles split mid-line across chunks', async () => {
    const stream = readableFrom([
      'data: {"foo',
      '":1}\n\n',
    ]);
    const events = await collect(parseSseStream(stream));
    expect(events).toEqual([{ kind: 'data', data: '{"foo":1}' }]);
  });

  it('emits done event for [DONE] sentinel', async () => {
    const stream = readableFrom([
      'data: {"foo":1}\n\ndata: [DONE]\n\n',
    ]);
    const events = await collect(parseSseStream(stream));
    expect(events).toEqual([
      { kind: 'data', data: '{"foo":1}' },
      { kind: 'done' },
    ]);
  });

  it('skips comment lines (starting with :)', async () => {
    const stream = readableFrom([
      ': heartbeat\n\ndata: {"x":1}\n\n',
    ]);
    const events = await collect(parseSseStream(stream));
    expect(events).toEqual([{ kind: 'data', data: '{"x":1}' }]);
  });

  it('skips non-data fields (event:, id:, etc.)', async () => {
    const stream = readableFrom([
      'event: ping\nid: 1\ndata: {"x":1}\n\n',
    ]);
    const events = await collect(parseSseStream(stream));
    expect(events).toEqual([{ kind: 'data', data: '{"x":1}' }]);
  });

  it('ignores blank chunks', async () => {
    const stream = readableFrom([
      '\n\n',
      'data: {"x":1}\n\n',
    ]);
    const events = await collect(parseSseStream(stream));
    expect(events).toEqual([{ kind: 'data', data: '{"x":1}' }]);
  });

  it('handles \\r\\n line endings', async () => {
    const stream = readableFrom([
      'data: {"x":1}\r\n\r\n',
    ]);
    const events = await collect(parseSseStream(stream));
    expect(events).toEqual([{ kind: 'data', data: '{"x":1}' }]);
  });

  it('emits remaining buffered data event when stream ends without trailing blank line', async () => {
    const stream = readableFrom([
      'data: {"x":1}',
    ]);
    const events = await collect(parseSseStream(stream));
    expect(events).toEqual([{ kind: 'data', data: '{"x":1}' }]);
  });
});
