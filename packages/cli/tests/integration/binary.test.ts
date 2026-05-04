// packages/cli/tests/integration/binary.test.ts
import { describe, expect, it, beforeAll } from 'vitest';
import { execa } from 'execa';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BIN = resolve(__dirname, '..', '..', 'dist', 'cli.cjs');

beforeAll(async () => {
  // Ensure the binary is built. If not, fail fast with a useful message.
  try {
    await stat(BIN);
  } catch {
    throw new Error(
      `${BIN} does not exist. Run \`pnpm --filter @openagentry/cli build\` before running integration tests.`,
    );
  }
});

describe('agentry binary (integration)', () => {
  it('agentry version prints CLI + protocol version', async () => {
    const { stdout, exitCode } = await execa('node', [BIN, 'version']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/agentry\s+\d+\.\d+/);
    expect(stdout).toMatch(/protocol\s+\d+/);
  });

  it('agentry version --json emits valid JSON', async () => {
    const { stdout, exitCode } = await execa('node', [BIN, 'version', '--json']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.cliVersion).toBeTruthy();
    expect(typeof parsed.protocolVersion).toBe('number');
  });

  it('agentry help lists commands', async () => {
    const { stdout, exitCode } = await execa('node', [BIN, 'help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('version');
    expect(stdout).toContain('doctor');
    expect(stdout).toContain('list');
    expect(stdout).toContain('capabilities');
  });

  it('agentry --version is equivalent to agentry version', async () => {
    const { stdout, exitCode } = await execa('node', [BIN, '--version']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/agentry/);
  });

  it('unknown command exits 1 with E_UNKNOWN_COMMAND on stderr', async () => {
    const { stderr, exitCode } = await execa('node', [BIN, 'nope'], { reject: false });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('E_UNKNOWN_COMMAND');
  });

  it('unknown command --json prints structured error to stderr', async () => {
    const { stderr, exitCode } = await execa('node', [BIN, 'nope', '--json'], { reject: false });
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stderr);
    expect(parsed.code).toBe('E_UNKNOWN_COMMAND');
  });
});
