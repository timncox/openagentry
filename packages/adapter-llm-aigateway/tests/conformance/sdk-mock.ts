/**
 * `ai` SDK mock factory backed by deterministic responses for the conformance
 * suite. Inspects prompt content to drive different paths (echo system, error
 * trigger, normal generation, count stream).
 *
 * @module
 */

import { ECHO_PROMPT, ERROR_PROMPT, SYSTEM_MARKER } from './prompts.js';

interface SdkOpts {
  model: string;
  prompt?: string;
  system?: string;
}

function isErrorPrompt(opts: SdkOpts): boolean {
  return typeof opts.prompt === 'string' && opts.prompt.includes(ERROR_PROMPT);
}

function buildText(opts: SdkOpts): string {
  if (typeof opts.prompt === 'string' && opts.prompt.includes(ECHO_PROMPT)) {
    if (typeof opts.system === 'string' && opts.system.includes(SYSTEM_MARKER)) {
      return `system says: ${opts.system}`;
    }
  }
  return 'mock response';
}

async function* countingStream(opts: SdkOpts): AsyncIterable<string> {
  if (isErrorPrompt(opts)) {
    throw Object.assign(new Error('triggered error'), {
      name: 'GatewayInternalServerError',
    });
  }
  yield 'one ';
  yield 'two ';
  yield 'three';
}

export async function makeSdkMock(): Promise<typeof import('ai')> {
  const actual = await import('ai');
  return {
    ...actual,
    generateText: (async (opts: SdkOpts) => {
      if (isErrorPrompt(opts)) {
        throw Object.assign(new Error('triggered error'), {
          name: 'GatewayInternalServerError',
        });
      }
      return {
        text: buildText(opts),
        usage: { inputTokens: 10, outputTokens: 5 },
      } as unknown as Awaited<ReturnType<typeof actual.generateText>>;
    }) as typeof actual.generateText,
    streamText: ((opts: SdkOpts) => {
      return {
        textStream: countingStream(opts),
        usage: Promise.resolve({ inputTokens: 5, outputTokens: 6 }),
      };
    }) as unknown as typeof actual.streamText,
  };
}
