/**
 * Suite runner. Loads a target, runs universal checks, dispatches to a
 * category functional suite if registered.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AgentryError,
  type AdapterCategory,
  type IsoTimestamp,
} from '@openagentry/core';
import { loadTarget } from './loader.js';
import { checkManifest } from './universal/manifest.js';
import { checkLlmDocs } from './universal/llm-docs.js';
import { checkAiFriendly } from './universal/ai-friendly.js';
import type { CheckResult, LoadedTarget, RunOpts, SuiteCtx, SuiteResult } from './types.js';

type FunctionalSuite = (target: LoadedTarget, ctx: SuiteCtx) => Promise<CheckResult[]>;

const functionalSuites = new Map<AdapterCategory, FunctionalSuite>();

/** Register a functional suite for a category. Used by suites/host.ts and suites/storage.ts. */
export function registerFunctionalSuite(
  category: AdapterCategory,
  suite: FunctionalSuite,
): void {
  functionalSuites.set(category, suite);
}


async function readPackageVersion(packageDir: string): Promise<string> {
  try {
    const raw = await readFile(join(packageDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function runSuite(opts: RunOpts): Promise<SuiteResult> {
  const startedAt = new Date().toISOString() as IsoTimestamp;
  const target = await loadTarget(opts.target);

  if (target.manifest.category === undefined) {
    throw new AgentryError({
      code: 'E_NO_CATEGORY',
      message: `Adapter manifest at ${target.packageDir} has no category. The conformance suite only runs against adapter plugins; non-adapter plugins (scaffold, mcp, command, skill) cannot be conformance-tested.`,
      phase: 'validate',
      context: { packageDir: target.packageDir, type: target.manifest.type },
    });
  }

  if (opts.category !== undefined && opts.category !== target.manifest.category) {
    throw new AgentryError({
      code: 'E_CATEGORY_MISMATCH',
      message: `Requested category "${opts.category}" but adapter manifest declares category "${target.manifest.category}".`,
      phase: 'validate',
      context: { requested: opts.category, declared: target.manifest.category },
    });
  }

  const ctx: SuiteCtx = { now: () => Date.now() };
  const checks: CheckResult[] = [];
  checks.push(...(await checkManifest(target, ctx)));
  checks.push(...(await checkAiFriendly(target, ctx)));
  checks.push(...(await checkLlmDocs(target, ctx)));

  if (opts.universalOnly !== true) {
    const cat = target.manifest.category;
    if (cat !== undefined) {
      const suite = functionalSuites.get(cat);
      if (suite !== undefined) {
        checks.push(...(await suite(target, ctx)));
      }
    }
  }

  let passed = 0,
    failed = 0,
    skipped = 0;
  for (const c of checks) {
    if (c.status === 'pass') passed += 1;
    else if (c.status === 'fail') failed += 1;
    else skipped += 1;
  }

  const version = await readPackageVersion(target.packageDir);
  const finishedAt = new Date().toISOString() as IsoTimestamp;

  return {
    adapter: {
      id: target.manifest.id,
      category: target.manifest.category,
      version,
    },
    passed,
    failed,
    skipped,
    total: checks.length,
    checks,
    startedAt,
    finishedAt,
  };
}
