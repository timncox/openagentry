/**
 * generate — spawns the configured CLI, awaits exit, returns final text +
 * model + optional usage. Maps errors to AgentryError with stable codes.
 *
 * @module
 */

import type {
  LlmGenerateOpts,
  LlmGenerateResult,
} from '@openagentry/core';
import type { CliDispatch } from '../dispatch/index.js';
import type { SpawnFn } from '../exec.js';
import { resolveBinary } from '../exec.js';
import { llmCliError, LLM_CLI_ERROR_CODES } from '../errors.js';
import type { LlmCliConfig } from '../config.js';

const DEFAULT_TIMEOUT_MS = 120_000;

interface GenerateContext {
  dispatch: CliDispatch;
  config: LlmCliConfig;
  spawn: SpawnFn;
}

export async function generate(
  ctx: GenerateContext,
  prompt: string,
  opts: LlmGenerateOpts = {},
): Promise<LlmGenerateResult> {
  const { dispatch, config, spawn } = ctx;
  const bin = resolveBinary(dispatch.bin, config.binPath);
  const args = dispatch.buildArgv(prompt, opts);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const child = spawn(bin, args, config.env !== undefined ? { env: config.env } : {});

  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout?.on('data', (d: Buffer) => {
    stdout += d.toString();
  });
  child.stderr?.on('data', (d: Buffer) => {
    stderr += d.toString();
  });

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, timeoutMs);

  const exitCode: number | null = await new Promise((resolve) => {
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  if (timedOut) {
    throw llmCliError({
      code: LLM_CLI_ERROR_CODES.TIMEOUT,
      message: `${dispatch.bin} CLI exceeded timeoutMs=${timeoutMs}.`,
      phase: 'generate',
      context: { stderr: stderr.slice(0, 1000) },
    });
  }

  if (exitCode !== 0) {
    if (dispatch.authErrorPattern.test(stderr)) {
      throw llmCliError({
        code: LLM_CLI_ERROR_CODES.AUTH,
        message: `${dispatch.bin} CLI rejected with auth error.`,
        phase: 'generate',
        suggestedFix: `Run \`${dispatch.bin} login\` (or set the appropriate API key env var) and try again.`,
        context: { stderr: stderr.slice(0, 1000) },
      });
    }
    throw llmCliError({
      code: LLM_CLI_ERROR_CODES.NONZERO,
      message: `${dispatch.bin} CLI exited with code ${exitCode}.`,
      phase: 'generate',
      context: { stderr: stderr.slice(0, 1000) },
    });
  }

  // Reconstruct text from stream-json if applicable; otherwise stdout itself is the text.
  const text = collectText(dispatch, stdout);
  const usage = dispatch.parseFinalUsage(stdout, stderr);
  const result: LlmGenerateResult = {
    text,
    model: opts.model ?? dispatch.models()[0]?.id ?? 'unknown',
  };
  if (usage !== undefined) {
    result.usage = usage;
  }
  return result;
}

function collectText(dispatch: CliDispatch, stdout: string): string {
  let text = '';
  for (const line of stdout.split('\n')) {
    const chunk = dispatch.parseStreamChunk(line);
    if (chunk?.type === 'text') text += chunk.text;
  }
  // If parseStreamChunk never recognized any line as text, fall back to raw stdout.
  if (text.length === 0) {
    return stdout.trim();
  }
  return text;
}
