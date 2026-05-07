import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOp } from '../../src/ops/generate.js';
import type { AigatewayLlmConfig } from '../../src/config.js';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

const { generateText: mockGenerate } = await import('ai');

const cfg: AigatewayLlmConfig = {
  apiKey: 'vck_TEST',
  baseUrl: 'https://ai-gateway.vercel.sh/v1',
  defaultModel: 'anthropic/claude-opus-4.6',
};

beforeEach(() => {
  vi.mocked(mockGenerate).mockReset();
});

describe('generateOp happy paths', () => {
  it('returns LlmGenerateResult for a basic prompt', async () => {
    vi.mocked(mockGenerate).mockResolvedValue({
      text: 'hello world',
      usage: { inputTokens: 10, outputTokens: 5 },
    } as Awaited<ReturnType<typeof mockGenerate>>);

    const out = await generateOp(cfg, 'Say hi.');
    expect(out.text).toBe('hello world');
    expect(out.model).toBe('anthropic/claude-opus-4.6');
    expect(out.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it('opts.model overrides cfg.defaultModel', async () => {
    vi.mocked(mockGenerate).mockResolvedValue({
      text: 'x',
      usage: { inputTokens: 1, outputTokens: 1 },
    } as Awaited<ReturnType<typeof mockGenerate>>);

    const out = await generateOp(cfg, 'p', { model: 'openai/gpt-5.4' });
    expect(out.model).toBe('openai/gpt-5.4');
    const call = vi.mocked(mockGenerate).mock.calls[0]?.[0] as { model: unknown };
    expect(call.model).toBe('openai/gpt-5.4');
  });

  it('passes system / temperature / maxTokens to SDK', async () => {
    vi.mocked(mockGenerate).mockResolvedValue({
      text: 'hello TEST_SYS_MARKER',
      usage: { inputTokens: 1, outputTokens: 1 },
    } as Awaited<ReturnType<typeof mockGenerate>>);

    await generateOp(cfg, 'Echo system.', {
      system: 'TEST_SYS_MARKER',
      temperature: 0.5,
      maxTokens: 100,
    });
    const call = vi.mocked(mockGenerate).mock.calls[0]?.[0] as {
      system?: string;
      temperature?: number;
      maxOutputTokens?: number;
    };
    expect(call.system).toBe('TEST_SYS_MARKER');
    expect(call.temperature).toBe(0.5);
    expect(call.maxOutputTokens).toBe(100);
  });

  it('handles SDK responses with promptTokens/completionTokens shape variants', async () => {
    vi.mocked(mockGenerate).mockResolvedValue({
      text: 'x',
      usage: { promptTokens: 7, completionTokens: 3 },
    } as unknown as Awaited<ReturnType<typeof mockGenerate>>);

    const out = await generateOp(cfg, 'p');
    expect(out.usage).toEqual({ inputTokens: 7, outputTokens: 3 });
  });

  it('omits usage when SDK response has no usage', async () => {
    vi.mocked(mockGenerate).mockResolvedValue({ text: 'x' } as unknown as Awaited<ReturnType<typeof mockGenerate>>);
    const out = await generateOp(cfg, 'p');
    expect(out.usage).toBeUndefined();
  });

  it('sets AI_GATEWAY_API_KEY from cfg.apiKey', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    vi.mocked(mockGenerate).mockResolvedValue({
      text: 'x',
      usage: { inputTokens: 1, outputTokens: 1 },
    } as Awaited<ReturnType<typeof mockGenerate>>);
    await generateOp(cfg, 'p');
    expect(process.env.AI_GATEWAY_API_KEY).toBe('vck_TEST');
  });
});

describe('generateOp model resolution', () => {
  it('throws E_AIGATEWAY_CONFIG_INVALID when no model resolvable', async () => {
    const noModel: AigatewayLlmConfig = { apiKey: 'k', baseUrl: cfg.baseUrl };
    await expect(generateOp(noModel, 'p')).rejects.toMatchObject({
      code: 'E_AIGATEWAY_CONFIG_INVALID',
      phase: 'generate',
    });
  });
});

describe('generateOp error mapping', () => {
  it('SDK APICallError 401 → AUTH', async () => {
    const sdkErr = Object.assign(new Error('Unauthorized'), { name: 'APICallError', statusCode: 401 });
    vi.mocked(mockGenerate).mockRejectedValue(sdkErr);
    await expect(generateOp(cfg, 'p')).rejects.toMatchObject({
      code: 'E_AIGATEWAY_AUTH',
      phase: 'generate',
    });
  });

  it('GatewayRateLimitError → RATE_LIMIT', async () => {
    const sdkErr = Object.assign(new Error('Too many'), { name: 'GatewayRateLimitError' });
    vi.mocked(mockGenerate).mockRejectedValue(sdkErr);
    await expect(generateOp(cfg, 'p')).rejects.toMatchObject({
      code: 'E_AIGATEWAY_RATE_LIMIT',
      phase: 'generate',
    });
  });

  it('GatewayInternalServerError → UPSTREAM', async () => {
    const sdkErr = Object.assign(new Error('boom'), { name: 'GatewayInternalServerError' });
    vi.mocked(mockGenerate).mockRejectedValue(sdkErr);
    await expect(generateOp(cfg, 'p')).rejects.toMatchObject({
      code: 'E_AIGATEWAY_UPSTREAM',
      phase: 'generate',
    });
  });

  it('LoadAPIKeyError → AUTH', async () => {
    const sdkErr = Object.assign(new Error('no key'), { name: 'LoadAPIKeyError' });
    vi.mocked(mockGenerate).mockRejectedValue(sdkErr);
    await expect(generateOp(cfg, 'p')).rejects.toMatchObject({
      code: 'E_AIGATEWAY_AUTH',
      phase: 'generate',
    });
  });

  it('TypeError (network) → NETWORK', async () => {
    vi.mocked(mockGenerate).mockRejectedValue(new TypeError('fetch failed'));
    await expect(generateOp(cfg, 'p')).rejects.toMatchObject({
      code: 'E_AIGATEWAY_NETWORK',
      phase: 'generate',
    });
  });

  it('unknown error → UPSTREAM', async () => {
    vi.mocked(mockGenerate).mockRejectedValue({ unexpected: true });
    await expect(generateOp(cfg, 'p')).rejects.toMatchObject({
      code: 'E_AIGATEWAY_UPSTREAM',
      phase: 'generate',
    });
  });
});
