/**
 * AdapterContext — passed into adapter lifecycle hooks (init, auth,
 * healthcheck, refresh). Holds environment-specific configuration that
 * adapters need.
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
