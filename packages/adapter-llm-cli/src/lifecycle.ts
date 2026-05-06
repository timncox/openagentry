/**
 * Lifecycle hooks for adapter-llm-cli.
 *
 * - init: validates binary resolves; throws E_LLM_CLI_NOT_FOUND if not.
 * - refresh: no-op (CLIs don't have a refresh story).
 * - healthcheck: spawns `<bin> --version`; passes if exit 0 within a short
 *   timeout. Failures map to E_LLM_CLI_NOT_FOUND or NONZERO depending on
 *   the cause.
 *
 * @module
 */

import type { CliDispatch } from './dispatch/index.js';
import { resolveBinary, type SpawnFn } from './exec.js';
import { llmCliError, LLM_CLI_ERROR_CODES } from './errors.js';
import type { LlmCliConfig } from './config.js';

const HEALTHCHECK_TIMEOUT_MS = 5_000;

interface LifecycleContext {
  dispatch: CliDispatch;
  config: LlmCliConfig;
  spawn: SpawnFn;
}

export async function init(ctx: LifecycleContext): Promise<void> {
  resolveBinary(ctx.dispatch.bin, ctx.config.binPath);
}

export async function refresh(_ctx: LifecycleContext): Promise<void> {
  // no-op; CLIs are stateless from the adapter's perspective.
}

export async function healthcheck(ctx: LifecycleContext): Promise<void> {
  const bin = resolveBinary(ctx.dispatch.bin, ctx.config.binPath);
  const child = ctx.spawn(bin, ['--version'], ctx.config.env !== undefined ? { env: ctx.config.env } : {});

  let stderr = '';
  child.stderr?.on('data', (d: Buffer) => {
    stderr += d.toString();
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, HEALTHCHECK_TIMEOUT_MS);

  const exitCode: number | null = await new Promise((res) => {
    child.on('exit', (code) => {
      clearTimeout(timer);
      res(code);
    });
  });

  if (timedOut) {
    throw llmCliError({
      code: LLM_CLI_ERROR_CODES.TIMEOUT,
      message: `${ctx.dispatch.bin} --version did not complete within ${HEALTHCHECK_TIMEOUT_MS}ms.`,
      phase: 'init',
    });
  }

  if (exitCode !== 0) {
    throw llmCliError({
      code: LLM_CLI_ERROR_CODES.NONZERO,
      message: `${ctx.dispatch.bin} --version exited with code ${exitCode}.`,
      phase: 'init',
      context: { stderr: stderr.slice(0, 500) },
    });
  }
}
