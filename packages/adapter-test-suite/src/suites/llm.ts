/**
 * LLM functional conformance suite. Self-registers with the runner.
 *
 * Five checks: list-models-returns-array, generate-returns-text,
 * generate-respects-system-opt, stream-emits-text-then-done,
 * structured-errors.
 *
 * Verification is done by exercising the adapter's three LlmAdapter
 * methods against deterministic prompts. Adapters that wrap a CLI
 * (like @openagentry/adapter-llm-cli) point at a stub binary in CI;
 * adapters with no external deps respond directly.
 *
 * @module
 */

import type { LlmAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { fail, getAdapterDefault, pass, timed } from '../internal/suite-helpers.js';

export const SYSTEM_MARKER = 'TEST_SYS_MARKER';
export const ECHO_PROMPT = 'Echo system.';
export const HELLO_PROMPT = 'Say hi.';
export const COUNT_PROMPT = 'Count to three.';
export const ERROR_PROMPT = 'error:nonzero';

export const llmSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapterDefault<LlmAdapter>(target, 'llm');
  if (adapter === undefined) {
    return [
      fail(
        'llm/list-models-returns-array',
        'Adapter default export missing or has wrong category (expected "llm").',
        0,
      ),
    ];
  }

  // llm/list-models-returns-array — non-empty array, each entry shaped { id, label, contextWindow, capabilities }.
  const lmWrap = await timed(ctx, () => adapter.listModels());
  if (!lmWrap.ok || lmWrap.result === undefined) {
    checks.push(
      fail(
        'llm/list-models-returns-array',
        `listModels threw: ${(lmWrap.err as Error)?.message ?? 'unknown'}`,
        lmWrap.durationMs,
      ),
    );
  } else if (!Array.isArray(lmWrap.result) || lmWrap.result.length === 0) {
    checks.push(
      fail(
        'llm/list-models-returns-array',
        'listModels must return a non-empty LlmModel[].',
        lmWrap.durationMs,
      ),
    );
  } else {
    const bad = lmWrap.result.find(
      (m) =>
        typeof m?.id !== 'string' ||
        typeof m?.label !== 'string' ||
        typeof m?.contextWindow !== 'number' ||
        m.contextWindow <= 0 ||
        typeof m?.capabilities !== 'object',
    );
    if (bad !== undefined) {
      checks.push(
        fail(
          'llm/list-models-returns-array',
          `listModels returned a model with bad shape: ${JSON.stringify(bad)}.`,
          lmWrap.durationMs,
        ),
      );
    } else {
      checks.push(
        pass('llm/list-models-returns-array', lmWrap.durationMs, {
          modelCount: lmWrap.result.length,
        }),
      );
    }
  }

  // llm/generate-returns-text — generate(HELLO_PROMPT) returns non-empty text + string model.
  const genWrap = await timed(ctx, () => adapter.generate(HELLO_PROMPT));
  if (!genWrap.ok || genWrap.result === undefined) {
    checks.push(
      fail(
        'llm/generate-returns-text',
        `generate threw: ${(genWrap.err as Error)?.message ?? 'unknown'}`,
        genWrap.durationMs,
      ),
    );
  } else if (typeof genWrap.result.text !== 'string' || genWrap.result.text.length === 0) {
    checks.push(
      fail(
        'llm/generate-returns-text',
        `generate returned empty/non-string text: ${JSON.stringify(genWrap.result)}.`,
        genWrap.durationMs,
      ),
    );
  } else if (typeof genWrap.result.model !== 'string' || genWrap.result.model.length === 0) {
    checks.push(
      fail(
        'llm/generate-returns-text',
        `generate returned non-string model: ${JSON.stringify(genWrap.result.model)}.`,
        genWrap.durationMs,
      ),
    );
  } else {
    checks.push(
      pass('llm/generate-returns-text', genWrap.durationMs, {
        textLength: genWrap.result.text.length,
        model: genWrap.result.model,
      }),
    );
  }

  // llm/generate-respects-system-opt — adapter must surface system prompt to the model.
  const sysWrap = await timed(ctx, () =>
    adapter.generate(ECHO_PROMPT, { system: SYSTEM_MARKER }),
  );
  if (!sysWrap.ok || sysWrap.result === undefined) {
    checks.push(
      fail(
        'llm/generate-respects-system-opt',
        `generate threw with system opt: ${(sysWrap.err as Error)?.message ?? 'unknown'}`,
        sysWrap.durationMs,
      ),
    );
  } else if (!sysWrap.result.text.includes(SYSTEM_MARKER)) {
    checks.push(
      fail(
        'llm/generate-respects-system-opt',
        `generate did not surface system prompt to output. Expected text to contain "${SYSTEM_MARKER}", got "${sysWrap.result.text.slice(0, 200)}".`,
        sysWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('llm/generate-respects-system-opt', sysWrap.durationMs));
  }

  // llm/stream-emits-text-then-done — at least one text chunk, exactly one done, no error.
  const streamStart = ctx.now();
  let textCount = 0;
  let doneCount = 0;
  let errorCount = 0;
  let streamThrew: unknown;
  try {
    for await (const chunk of adapter.stream(COUNT_PROMPT)) {
      if (chunk.type === 'text') textCount++;
      else if (chunk.type === 'done') doneCount++;
      else if (chunk.type === 'error') errorCount++;
    }
  } catch (err) {
    streamThrew = err;
  }
  const streamDur = Math.max(0, ctx.now() - streamStart);
  if (streamThrew !== undefined) {
    checks.push(
      fail(
        'llm/stream-emits-text-then-done',
        `stream threw mid-iteration: ${(streamThrew as Error)?.message ?? 'unknown'}`,
        streamDur,
      ),
    );
  } else if (textCount === 0) {
    checks.push(
      fail(
        'llm/stream-emits-text-then-done',
        `stream emitted zero text chunks (got text=${textCount}, done=${doneCount}, error=${errorCount}).`,
        streamDur,
      ),
    );
  } else if (doneCount !== 1) {
    checks.push(
      fail(
        'llm/stream-emits-text-then-done',
        `stream must emit exactly one done chunk; got ${doneCount}.`,
        streamDur,
      ),
    );
  } else if (errorCount > 0) {
    checks.push(
      fail(
        'llm/stream-emits-text-then-done',
        `stream emitted ${errorCount} error chunks on a healthy prompt.`,
        streamDur,
      ),
    );
  } else {
    checks.push(
      pass('llm/stream-emits-text-then-done', streamDur, {
        textChunks: textCount,
      }),
    );
  }

  // llm/structured-errors — generate(ERROR_PROMPT) must throw AgentryError, never plain Error.
  const seWrap = await timed(ctx, () => adapter.generate(ERROR_PROMPT));
  if (seWrap.ok) {
    checks.push(
      fail(
        'llm/structured-errors',
        `generate('${ERROR_PROMPT}') succeeded; expected throw.`,
        seWrap.durationMs,
      ),
    );
  } else if (!isAgentryError(seWrap.err)) {
    checks.push(
      fail(
        'llm/structured-errors',
        `generate threw non-AgentryError (${(seWrap.err as Error)?.constructor?.name ?? typeof seWrap.err}). All adapter-side failures must be AgentryError.`,
        seWrap.durationMs,
      ),
    );
  } else {
    checks.push(
      pass('llm/structured-errors', seWrap.durationMs, {
        code: seWrap.err.code,
      }),
    );
  }

  return checks;
};

registerFunctionalSuite('llm', llmSuite);
