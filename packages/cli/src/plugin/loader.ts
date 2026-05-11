/**
 * Plugin loader. Given a workspace root and a package name, resolve the
 * package, dynamic-import it, validate its `openagentry` manifest block,
 * and (for adapter plugins) register the adapter with `@openagentry/core`.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  AgentryError,
  registerAdapter,
  validateManifest,
  type PluginManifest,
} from '@openagentry/core';

export interface LoadedPlugin {
  /** Bare package name, e.g. `@openagentry/adapter-host-cloudflare`. */
  name: string;
  /** Resolved on-disk path to the package's main entry. */
  resolvedPath: string;
  /** The plugin's directory (containing package.json). */
  packageDir: string;
  /** Validated manifest from package.json's `openagentry` block. */
  manifest: PluginManifest;
  /** The default export of the module — the adapter, scaffold, etc. */
  module: unknown;
}

/**
 * Resolve a plugin package from `workspaceRoot/node_modules/<name>` and load
 * it. Throws `AgentryError` on missing package or invalid manifest.
 */
export async function loadPlugin(
  workspaceRoot: string,
  packageName: string,
): Promise<LoadedPlugin> {
  const resolveFrom = createRequire(join(workspaceRoot, 'package.json'));

  let resolvedPath: string;
  try {
    resolvedPath = resolveFrom.resolve(packageName);
  } catch (err) {
    throw new AgentryError({
      code: 'E_PLUGIN_NOT_FOUND',
      message: `Plugin "${packageName}" is not installed in workspace at ${workspaceRoot}.`,
      phase: 'install',
      suggestedFix: `agentry install ${packageName}`,
      context: { workspaceRoot, packageName },
      cause: err,
    });
  }

  // packageDir = directory containing package.json. Walk upward from the
  // resolved entry point until we find the package.json with the matching name.
  const packageDir = await findPackageDir(resolvedPath, packageName);
  const manifest = await readPluginManifest(packageDir);
  const module = await import(pathToFileURL(resolvedPath).href);

  return { name: packageName, resolvedPath, packageDir, manifest, module };
}

async function findPackageDir(entryPath: string, expectedName: string): Promise<string> {
  let cursor = dirname(entryPath);
  while (true) {
    try {
      const raw = await readFile(join(cursor, 'package.json'), 'utf8');
      const pkg = JSON.parse(raw) as { name?: string };
      if (pkg.name === expectedName) return cursor;
    } catch {
      // continue walking
    }
    const parent = dirname(cursor);
    if (parent === cursor) {
      throw new AgentryError({
        code: 'E_PLUGIN_LAYOUT',
        message: `Could not locate package.json for "${expectedName}" near ${entryPath}.`,
        phase: 'install',
        context: { entryPath, expectedName },
      });
    }
    cursor = parent;
  }
}

async function readPluginManifest(packageDir: string): Promise<PluginManifest> {
  const pkgPath = join(packageDir, 'package.json');
  const raw = await readFile(pkgPath, 'utf8');
  let pkg: { openagentry?: unknown };
  try {
    pkg = JSON.parse(raw) as { openagentry?: unknown };
  } catch (err) {
    throw new AgentryError({
      code: 'E_PLUGIN_PACKAGE_JSON',
      message: `${pkgPath} is not valid JSON.`,
      phase: 'validate',
      cause: err,
    });
  }
  if (pkg.openagentry === undefined) {
    throw new AgentryError({
      code: 'E_PLUGIN_NO_MANIFEST',
      message: `${pkgPath} has no "openagentry" manifest block.`,
      phase: 'validate',
      suggestedFix: `Add an "openagentry" block to package.json (see @openagentry/core docs).`,
      context: { pkgPath },
    });
  }
  return validateManifest(pkg.openagentry);
}

interface AdapterMinimalShape {
  readonly category: string;
  readonly id: string;
}

function isAdapterShape(value: unknown): value is AdapterMinimalShape {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { category?: unknown }).category === 'string' &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

/**
 * Find the adapter on a dynamic-imported module, accounting for Node's CJS-ESM
 * interop. ESM packages give us `mod.default = adapter`. CJS packages built with
 * tsup wrap `module.exports = { default: adapter, ...named }`, so dynamic import
 * gives `mod.default = entire exports` and the real adapter is at
 * `mod.default.default`.
 */
function findAdapterExport(mod: unknown): AdapterMinimalShape | undefined {
  const candidate = (mod as { default?: unknown }).default;
  if (isAdapterShape(candidate)) return candidate;
  // CJS-ESM double-default interop.
  const inner = (candidate as { default?: unknown } | undefined)?.default;
  if (isAdapterShape(inner)) return inner;
  return undefined;
}

/**
 * Some adapters intentionally export `default: null` when their required env
 * vars are absent (so the package can be imported safely without crashing).
 * The lazy-default pattern is preferred, but null-on-missing-config is a
 * legitimate shape that the loader should accept by skipping registration —
 * the manifest still describes the plugin to `capabilities`.
 */
function isExplicitlyNullDefault(mod: unknown): boolean {
  const candidate = (mod as { default?: unknown }).default;
  if (candidate === null) return true;
  // CJS-ESM interop: mod.default = entire exports object, mod.default.default = null
  const inner = (candidate as { default?: unknown } | undefined)?.default;
  return inner === null;
}

/**
 * For adapter plugins, register the adapter exported by the module. No-op for
 * non-adapter plugin types (scaffold/mcp/command/skill) AND for adapters whose
 * default export is explicitly null (needs config — `capabilities` will still
 * report them via the manifest).
 */
export function registerAdaptersFromPlugin(plugin: LoadedPlugin): void {
  if (plugin.manifest.type !== 'adapter') return;
  const exported = findAdapterExport(plugin.module);
  if (exported === undefined) {
    if (isExplicitlyNullDefault(plugin.module)) {
      // Adapter loaded but needs config to instantiate. Manifest already drives
      // category/id reporting; skip registration silently.
      return;
    }
    throw new AgentryError({
      code: 'E_PLUGIN_BAD_EXPORT',
      message: `Adapter plugin "${plugin.name}" must default-export an object with { category, id }.`,
      phase: 'validate',
      context: { name: plugin.name, resolvedPath: plugin.resolvedPath },
    });
  }
  if (plugin.manifest.category !== undefined && exported.category !== plugin.manifest.category) {
    throw new AgentryError({
      code: 'E_PLUGIN_CATEGORY_MISMATCH',
      message: `Adapter "${plugin.name}" declares category "${plugin.manifest.category}" but exports an adapter with category "${exported.category}".`,
      phase: 'validate',
      context: { manifestCategory: plugin.manifest.category, exportedCategory: exported.category },
    });
  }
  registerAdapter(exported.category, exported);
}
