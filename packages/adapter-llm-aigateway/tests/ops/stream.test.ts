import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamOp } from '../../src/ops/stream.js';
import type { AigatewayLlmConfig } from '../../src/config.js';
import type { LlmStreamChunk } from '@openagentry/core';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(),
  };
});

const { streamText: mockStream } = await import('ai');

const cfg: AigatewayLlmConfig = {
  apiKey: 'vck_TEST',
  baseUrl: 'https://ai-gateway.vercel.sh/v1',
  defaultModel: 'anthropic/claude-opus-4.6',
};

beforeEach(() => {
  vi.mocked(mockStream).mockReset();
});

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

describe('streamOp happy paths', () => {
  it('yields text chunks then done with usage', async () => {
    vi.mocked(mockStream).mockReturnValue({
      textStream: asAsyncIterable(['Hello', ' ', 'world']),
      usage: Promise.resolve({ inputTokens: 5, outputTokens: 10 }),
    } as unknown as ReturnType<typeof mockStream>);

    const out = await collect(streamOp(cfg, 'p'));
    const texts = out.filter((c): c is Extract<LlmStreamChunk, { type: 'text' }> => c.type === 'text');
    const dones = out.filter((c): c is Extract<LlmStreamChunk, { type: 'done' }> => c.type === 'done');
    expect(texts).toHaveLength(3);
    expect(texts.map((t) => t.text)).toEqual(['Hello', ' ', 'world']);
    expect(dones).toHaveLength(1);
    expect(dones[0]?.usage).toEqual({ inputTokens: 5, outputTokens: 10 });
  });

  it('yields done with no usage when SDK has no usage', async () => {
    vi.mocked(mockStream).mockReturnValue({
      textStream: asAsyncIterable(['x']),
      usage: Promise.resolve(undefined),
    } as unknown as ReturnType<typeof mockStream>);

    const out = await collect(streamOp(cfg, 'p'));
    const dones = out.filter((c): c is Extract<LlmStreamChunk, { type: 'done' }> => c.type === 'done');
    expect(dones).toHaveLength(1);
    expect(dones[0]?.usage).toBeUndefined();
  });

  it('handles empty stream (zero text chunks, still emits done)', async () => {
    vi.mocked(mockStream).mockReturnValue({
      textStream: asAsyncIterable<string>([]),
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
    } as unknown as ReturnType<typeof mockStream>);

    const out = await collect(streamOp(cfg, 'p'));
    expect(out.filter((c) => c.type === 'text')).toHaveLength(0);
    expect(out.filter((c) => c.type === 'done')).toHaveLength(1);
  });
});

describe('streamOp model resolution + errors', () => {
  it('yields error chunk when no model resolvable (no throw)', async () => {
    const noModel: AigatewayLlmConfig = { apiKey: 'k', baseUrl: cfg.baseUrl };
    const out = await collect(streamOp(noModel, 'p'));
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe('error');
    expect((out[0] as { type: 'error'; message: string }).message).toMatch(/E_AIGATEWAY_CONFIG_INVALID|model/i);
  });

  it('SDK throws synchronously → yields error chunk', async () => {
    vi.mocked(mockStream).mockImplementation(() => {
      throw Object.assign(new Error('Bad request'), { name: 'APICallError', statusCode: 400 });
    });
    const out = await collect(streamOp(cfg, 'p'));
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe('error');
  });

  it('error during textStream iteration → yields error chunk after partial text', async () => {
    async function* faulty(): AsyncIterable<string> {
      yield 'partial';
      throw Object.assign(new Error('boom'), { name: 'APICallError', statusCode: 500 });
    }
    vi.mocked(mockStream).mockReturnValue({
      textStream: faulty(),
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
    } as unknown as ReturnType<typeof mockStream>);

    const out = await collect(streamOp(cfg, 'p'));
    expect(out.filter((c) => c.type === 'text')).toHaveLength(1);
    expect(out.find((c) => c.type === 'error')).toBeDefined();
  });
});
