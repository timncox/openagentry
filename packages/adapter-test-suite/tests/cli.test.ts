import { describe, expect, it, beforeAll } from 'vitest';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bin = join(__dirname, '..', 'dist', 'cli.cjs');
const goodHost = join(__dirname, 'fixtures', 'good-host');
const badHost = join(__dirname, 'fixtures', 'bad-host');

beforeAll(async () => {
  // The bin must be built before running these tests. CI runs `pnpm -r build`
  // before `pnpm -r test`; for local runs, ensure dist/cli.cjs exists.
  const { existsSync } = await import('node:fs');
  if (!existsSync(bin)) {
    throw new Error(`bin not built: ${bin}. Run \`pnpm --filter @openagentry/adapter-test-suite build\` first.`);
  }
});

describe('agentry-adapter-test bin', () => {
  it('--help prints usage and exits 0', async () => {
    const r = await execa('node', [bin, '--help']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('agentry-adapter-test');
    expect(r.stdout).toContain('--target');
  });

  it('passes against good-host (exit 0, text mode)', async () => {
    const r = await execa('node', [bin, 'host', '--target', goodHost]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('✓ manifest/valid');
    expect(r.stdout).toContain('✓ host/createProject');
    expect(r.stdout).toMatch(/9 passed, 0 failed/);
  });

  it('fails against bad-host (exit 1)', async () => {
    const r = await execa('node', [bin, 'host', '--target', badHost], { reject: false });
    expect(r.exitCode).toBe(1);
  });

  it('--json emits parseable SuiteResult', async () => {
    const r = await execa('node', [bin, 'host', '--target', goodHost, '--json']);
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(r.stdout) as { adapter: { id: string }; passed: number };
    expect(parsed.adapter.id).toBe('good-host');
    expect(parsed.passed).toBe(9);
  });

  it('--universal-only restricts to 4 universal checks', async () => {
    const r = await execa('node', [bin, 'host', '--target', goodHost, '--json', '--universal-only']);
    const parsed = JSON.parse(r.stdout) as { total: number };
    expect(parsed.total).toBe(4);
  });

  it('exits 2 when --target is missing', async () => {
    const r = await execa('node', [bin, 'host'], { reject: false });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain('--target');
  });
});
