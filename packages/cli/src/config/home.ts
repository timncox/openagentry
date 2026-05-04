/**
 * Read/write `~/.agentry/config.json` (home-level CLI config).
 *
 * The path is constructed from a `homeDir` argument so tests can use a temp
 * directory; the production caller passes `os.homedir()`.
 *
 * @module
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AgentryError } from '@openagentry/core';
import { homeConfigSchema, type HomeConfig } from './schema.js';

export function defaultHomeConfig(): HomeConfig {
  return { telemetryOptIn: false };
}

function homeConfigPath(homeDir: string): string {
  return join(homeDir, '.agentry', 'config.json');
}

export async function readHomeConfig(homeDir: string): Promise<HomeConfig> {
  const path = homeConfigPath(homeDir);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultHomeConfig();
    }
    throw new AgentryError({
      code: 'E_HOME_CONFIG_READ',
      message: `Cannot read ${path}: ${(err as Error).message}`,
      phase: 'init',
      cause: err,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new AgentryError({
      code: 'E_HOME_CONFIG_INVALID',
      message: `${path} is not valid JSON: ${(err as Error).message}`,
      phase: 'validate',
      suggestedFix: `Delete ${path} to reset to defaults.`,
      cause: err,
    });
  }

  const result = homeConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new AgentryError({
      code: 'E_HOME_CONFIG_INVALID',
      message: `${path} failed schema validation: ${result.error.message}`,
      phase: 'validate',
      context: { issues: result.error.issues },
    });
  }
  return result.data;
}

export async function writeHomeConfig(homeDir: string, cfg: HomeConfig): Promise<void> {
  const path = homeConfigPath(homeDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}
