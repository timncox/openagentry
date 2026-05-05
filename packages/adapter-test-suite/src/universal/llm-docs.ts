/**
 * Universal LLM.md doc check.
 *
 * Heuristic token count: ceil(text.length / 4). Approximates English token
 * counts well enough for a v0 budget gate.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';

const MAX_TOKENS = 1024;
const MIN_CHARS = 100;
const MIN_H2_SECTIONS = 2;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function countH2Sections(text: string): number {
  let n = 0;
  for (const line of text.split('\n')) {
    if (/^##\s+\S/.test(line)) n += 1;
  }
  return n;
}

export async function checkLlmDocs(
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> {
  const start = ctx.now();
  const path = join(target.packageDir, 'LLM.md');

  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return [
      {
        id: 'docs/llm-md',
        status: 'fail',
        message: `LLM.md not found at ${path}.`,
        durationMs: Math.max(0, ctx.now() - start),
      },
    ];
  }

  if (text.length < MIN_CHARS) {
    return [
      {
        id: 'docs/llm-md',
        status: 'fail',
        message: `LLM.md is too short (${text.length} chars; minimum ${MIN_CHARS}).`,
        details: { chars: text.length, minChars: MIN_CHARS },
        durationMs: Math.max(0, ctx.now() - start),
      },
    ];
  }

  const tokens = estimateTokens(text);
  if (tokens > MAX_TOKENS) {
    return [
      {
        id: 'docs/llm-md',
        status: 'fail',
        message: `LLM.md exceeds ${MAX_TOKENS}-token budget (estimated ${tokens}).`,
        details: { tokens, maxTokens: MAX_TOKENS },
        durationMs: Math.max(0, ctx.now() - start),
      },
    ];
  }

  const h2 = countH2Sections(text);
  if (h2 < MIN_H2_SECTIONS) {
    return [
      {
        id: 'docs/llm-md',
        status: 'fail',
        message: `LLM.md must have at least ${MIN_H2_SECTIONS} H2 sections (found ${h2}).`,
        details: { h2Sections: h2, minH2Sections: MIN_H2_SECTIONS },
        durationMs: Math.max(0, ctx.now() - start),
      },
    ];
  }

  return [
    {
      id: 'docs/llm-md',
      status: 'pass',
      details: { tokens, h2Sections: h2, chars: text.length },
      durationMs: Math.max(0, ctx.now() - start),
    },
  ];
}
