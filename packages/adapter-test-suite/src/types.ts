/**
 * Shared types for the conformance runner.
 *
 * @module
 */

import type { AdapterCategory, PluginManifest } from '@openagentry/core';

export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface CheckResult {
  /** Stable id of the check, e.g. "manifest/valid". */
  id: string;
  status: CheckStatus;
  /** Human-readable detail; required when status === "fail". */
  message?: string;
  /** Free-form structured detail (e.g. token counts, diffs). */
  details?: Record<string, unknown>;
  durationMs: number;
}

export interface SuiteResult {
  adapter: {
    id: string;
    category: AdapterCategory;
    version: string;
  };
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  checks: CheckResult[];
  /** ISO-8601. */
  startedAt: string;
  /** ISO-8601. */
  finishedAt: string;
}

export interface RunOpts {
  /** Absolute path to the adapter package directory (containing package.json). */
  target: string;
  /** Optional category override; if omitted, read from manifest. Used by the CLI to assert the user-supplied category matches. */
  category?: AdapterCategory;
  /** If true, skip the category functional suite even when one is registered. */
  universalOnly?: boolean;
}

export interface LoadedTarget {
  packageDir: string;
  manifest: PluginManifest;
  /** The dynamic-imported module. The adapter is the `default` export. */
  module: unknown;
}

export interface SuiteCtx {
  /** Returns a millisecond timestamp. Injected so tests can deterministically stamp durations. */
  now: () => number;
}
