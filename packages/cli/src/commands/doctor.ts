/**
 * `agentry doctor` — environment + workspace healthcheck.
 *
 * v0 checks:
 * - node-version: Node ≥ 20
 * - home-config: ~/.agentry/config.json is missing-or-readable (not corrupt)
 * - workspace: did we locate a workspace from cwd? (warn if no)
 *
 * @module
 */

import { homedir } from 'node:os';
import { defineCommand } from '../command.js';
import { readHomeConfig } from '../config/home.js';
import { locateWorkspaceRoot } from '../config/workspace.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

async function runChecks(cwd: string): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  out.push({
    name: 'node-version',
    status: nodeMajor >= 20 ? 'pass' : 'fail',
    detail: `Node ${process.version} (need ≥ v20)`,
  });

  try {
    await readHomeConfig(homedir());
    out.push({ name: 'home-config', status: 'pass', detail: 'home config readable' });
  } catch (err) {
    out.push({
      name: 'home-config',
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const wsRoot = await locateWorkspaceRoot(cwd);
  if (wsRoot !== undefined) {
    out.push({ name: 'workspace', status: 'pass', detail: `workspace at ${wsRoot}` });
  } else {
    out.push({
      name: 'workspace',
      status: 'warn',
      detail: 'no workspace found upward from cwd; run `agentry init` to create one',
    });
  }

  return out;
}

export const doctorCommand = defineCommand({
  name: 'doctor',
  summary: 'Check environment and workspace health.',
  async run(_args, output, ctx) {
    const checks = await runChecks(ctx.cwd);
    output.text('');
    for (const c of checks) {
      const icon = c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗';
      output.text(`${icon} ${c.name}: ${c.detail}`);
    }
    output.text('');

    const anyFail = checks.some((c) => c.status === 'fail');
    output.json({
      checks,
      summary: anyFail ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass',
    });
    return anyFail ? 1 : 0;
  },
});
