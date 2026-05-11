/**
 * `agentry version` — prints CLI + protocol versions and runtime info.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL_VERSION } from '@openagentry/core';
import { defineCommand } from '../command.js';

interface PackageJsonShape {
  name?: string;
  version?: string;
}

async function readCliVersion(): Promise<string> {
  // The bundled CJS lives at packages/cli/dist/cli.cjs — package.json is one
  // dir up. In test mode we run from src/commands/, where package.json is two
  // dirs up. Try both, dist layout first.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const here = typeof __dirname === 'string' ? __dirname : dirname(fileURLToPath((import.meta as any).url));
  for (const candidate of [
    join(here, '..', 'package.json'),
    join(here, '..', '..', 'package.json'),
  ]) {
    try {
      const raw = await readFile(candidate, 'utf8');
      const pkg = JSON.parse(raw) as PackageJsonShape;
      if (typeof pkg.name === 'string' && pkg.name === '@openagentry/cli' && typeof pkg.version === 'string') {
        return pkg.version;
      }
    } catch {
      // try next
    }
  }
  return '0.0.0';
}

export const versionCommand = defineCommand({
  name: 'version',
  summary: 'Print agentry CLI and protocol versions.',
  async run(_args, output) {
    const cliVersion = await readCliVersion();
    output.text(`agentry ${cliVersion} (protocol ${PROTOCOL_VERSION})`);
    output.json({
      cliVersion,
      protocolVersion: PROTOCOL_VERSION,
      node: process.version,
      platform: process.platform,
    });
    return 0;
  },
});
