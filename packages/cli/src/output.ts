/**
 * Output formatter. Every command writes through this so the `--json` flag
 * cleanly switches the surface format without each command re-implementing
 * the toggle. The constructor option is `mode: 'json' | 'text'` so the
 * option name doesn't collide with the `json()` method.
 *
 * @module
 */

import type { Writable } from 'node:stream';
import { AgentryError, isAgentryError } from '@openagentry/core';

export interface OutputOptions {
  mode: 'json' | 'text';
  stdout?: Writable;
  stderr?: Writable;
}

export class Output {
  private readonly mode: 'json' | 'text';
  private readonly stdout: Writable;
  private readonly stderr: Writable;

  constructor(opts: OutputOptions) {
    this.mode = opts.mode;
    this.stdout = opts.stdout ?? process.stdout;
    this.stderr = opts.stderr ?? process.stderr;
  }

  /**
   * Write a human-readable line. Suppressed in JSON mode so progress chatter
   * doesn't pollute machine-parseable output.
   */
  text(message: string): void {
    if (this.mode === 'json') return;
    this.stdout.write(`${message}\n`);
  }

  /** Always writes JSON. In text mode, pretty-prints; in JSON mode, compact. */
  json(payload: unknown): void {
    const serialized =
      this.mode === 'json'
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
    this.stdout.write(`${serialized}\n`);
  }

  /**
   * Write an error. AgentryErrors keep their structure; plain errors get
   * wrapped so the surface stays uniform.
   */
  error(err: unknown): void {
    const wrapped = isAgentryError(err)
      ? err
      : new AgentryError({
          code: 'E_UNKNOWN',
          message: err instanceof Error ? err.message : String(err),
          phase: 'unknown',
        });

    if (this.mode === 'json') {
      this.stderr.write(`${JSON.stringify(wrapped.toJSON())}\n`);
      return;
    }

    const lines = [`error: ${wrapped.code}`, `  ${wrapped.message}`, `  phase: ${wrapped.phase}`];
    if (wrapped.adapter !== undefined) lines.push(`  adapter: ${wrapped.adapter}`);
    if (wrapped.suggestedFix !== undefined) lines.push(`  fix: ${wrapped.suggestedFix}`);
    if (wrapped.docs !== undefined) lines.push(`  docs: ${wrapped.docs}`);
    if (wrapped.context !== undefined) {
      lines.push(`  context: ${JSON.stringify(wrapped.context)}`);
    }
    this.stderr.write(`${lines.join('\n')}\n`);
  }
}
