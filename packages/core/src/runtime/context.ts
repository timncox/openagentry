/**
 * AdapterContext — environment-specific configuration that adapter
 * implementations may consume from their own constructor or factory.
 *
 * Reserved as the parameter shape for future protocol-level lifecycle
 * hooks (`init`, `auth`, `healthcheck`, `refresh`). At protocol v1 those
 * hooks are not part of the adapter interfaces — the runtime does not
 * call them. Adapters that need workspace paths, secrets, or a logger
 * may accept this shape internally; the framework will start invoking
 * lifecycle hooks once they are added to the protocol.
 *
 * @module
 */

import type { Env } from '../types.js';

export interface AdapterContext {
  /** Active workspace path on disk. */
  workspacePath: string;
  /** Active project path within the workspace, if applicable. */
  projectPath?: string;
  /** Environment for which this context applies. */
  env: Env;
  /**
   * Reads an environment variable from the configured credential store.
   * Adapters should use this rather than `process.env` directly.
   */
  getSecret(name: string): Promise<string | undefined>;
  /** Writes a secret to the credential store. */
  setSecret(name: string, value: string): Promise<void>;
  /** Logs a structured event to stdout / wherever the framework collects logs. */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void;
}
