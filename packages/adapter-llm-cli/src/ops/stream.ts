/**
 * stream — async iterable of LlmStreamChunk events. Spawns the CLI and
 * yields chunks as stdout lines arrive. Sends SIGTERM on consumer break.
 *
 * @module
 */

import type {
  LlmGenerateOpts,
  LlmStreamChunk,
} from '@openagentry/core';
import type { CliDispatch } from '../dispatch/index.js';
import type { SpawnFn } from '../exec.js';
import { resolveBinary } from '../exec.js';
import type { LlmCliConfig } from '../config.js';

const DEFAULT_TIMEOUT_MS = 120_000;

interface StreamContext {
  dispatch: CliDispatch;
  config: LlmCliConfig;
  spawn: SpawnFn;
}

export async function* stream(
  ctx: StreamContext,
  prompt: string,
  opts: LlmGenerateOpts = {},
): AsyncGenerator<LlmStreamChunk, void, void> {
  const { dispatch, config, spawn } = ctx;
  const bin = resolveBinary(dispatch.bin, config.binPath);
  const args = dispatch.buildArgv(prompt, opts);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const child = spawn(bin, args, config.env !== undefined ? { env: config.env } : {});

  let stderr = '';
  let stdoutBuffer = '';
  child.stderr?.on('data', (d: Buffer) => {
    stderr += d.toString();
  });

  const queue: LlmStreamChunk[] = [];
  let exited: { code: number | null } | undefined;
  let resolveWaiter: (() => void) | undefined;
  let doneEmittedFromStream = false;
  const wake = () => {
    if (resolveWaiter !== undefined) {
      const r = resolveWaiter;
      resolveWaiter = undefined;
      r();
    }
  };

  function pushParsedLine(line: string): void {
    const chunk = dispatch.parseStreamChunk(line);
    if (chunk === null) return;
    if (chunk.type === 'done') doneEmittedFromStream = true;
    queue.push(chunk);
  }

  child.stdout?.on('data', (d: Buffer) => {
    stdoutBuffer += d.toString();
    let nl: number;
    while ((nl = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, nl);
      stdoutBuffer = stdoutBuffer.slice(nl + 1);
      pushParsedLine(line);
    }
    wake();
  });

  child.on('exit', (code) => {
    if (stdoutBuffer.length > 0) {
      pushParsedLine(stdoutBuffer);
      stdoutBuffer = '';
    }
    exited = { code };
    wake();
  });

  const timer = setTimeout(() => {
    timedOut = true;
    queue.push({
      type: 'error',
      message: `${dispatch.bin} CLI exceeded timeoutMs=${timeoutMs}.`,
    });
    wake();
    child.kill('SIGTERM');
  }, timeoutMs);

  let cancelled = false;
  let timedOut = false;
  try {
    while (true) {
      // Drain everything currently buffered.
      while (queue.length > 0) {
        const chunk = queue.shift()!;
        yield chunk;
      }
      if (exited !== undefined) {
        // Process exited. Synthesize a done chunk only if the dispatch's
        // own stream parser hasn't already produced one (e.g., claude's
        // stream-json result block). For non-zero exits, emit an error
        // chunk instead — but only if the consumer hasn't broken (cancelled).
        if (exited.code === 0) {
          if (!doneEmittedFromStream) {
            yield { type: 'done' };
          }
        } else if (!cancelled && !timedOut) {
          const message = dispatch.authErrorPattern.test(stderr)
            ? `${dispatch.bin} CLI rejected with auth error: ${stderr.slice(0, 200)}`
            : `${dispatch.bin} CLI exited with code ${exited.code}: ${stderr.slice(0, 200)}`;
          yield { type: 'error', message };
        }
        return;
      }
      // Wait for next push.
      await new Promise<void>((res) => {
        resolveWaiter = res;
      });
    }
  } finally {
    cancelled = true;
    clearTimeout(timer);
    if (exited === undefined) {
      child.kill('SIGTERM');
    }
  }
}
