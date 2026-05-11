// packages/cli/tests/integration/binary.test.ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import { resolve, join } from 'node:path';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BIN = resolve(__dirname, '..', '..', 'dist', 'cli.cjs');
const PKG = resolve(__dirname, '..', '..', 'package.json');
const TSUP_FIXTURE = resolve(__dirname, '..', 'fixtures', 'fake-tsup-adapter');
const NULL_DEFAULT_FIXTURE = resolve(__dirname, '..', 'fixtures', 'fake-null-default-adapter');

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

  it('agentry version reports the version from package.json (not 0.0.0)', async () => {
    const pkg = JSON.parse(await readFile(PKG, 'utf8')) as { version: string };
    const { stdout } = await execa('node', [BIN, 'version', '--json']);
    const parsed = JSON.parse(stdout) as { cliVersion: string };
    expect(parsed.cliVersion).toBe(pkg.version);
    expect(parsed.cliVersion).not.toBe('0.0.0');
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

describe('agentry capabilities (integration, against tsup-style adapter)', () => {
  let workspaceRoot: string;
  beforeAll(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'agentry-int-'));
    const target = join(workspaceRoot, 'node_modules', 'fake-tsup-adapter');
    await mkdir(target, { recursive: true });
    await cp(TSUP_FIXTURE, target, { recursive: true });
    await writeFile(join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'integ-ws' }));
    await mkdir(join(workspaceRoot, '.agentry'), { recursive: true });
    await writeFile(
      join(workspaceRoot, '.agentry', 'workspace.json'),
      JSON.stringify({ plugins: ['fake-tsup-adapter'], defaultEnv: 'dev' }),
    );
  });
  afterAll(async () => {
    if (workspaceRoot !== undefined) await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('loads tsup-bundled CJS adapters without phantom loadErrors', async () => {
    const { stdout, exitCode } = await execa('node', [BIN, 'capabilities', '--json'], {
      cwd: workspaceRoot,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      categories: Record<string, { adapterId: string }>;
      loadErrors: Array<{ name: string; code: string }>;
    };
    expect(parsed.categories.host?.adapterId).toBe('fake-tsup-host');
    expect(parsed.loadErrors).toEqual([]);
  });
});

describe('agentry capabilities (integration, against null-default adapter)', () => {
  let workspaceRoot: string;
  beforeAll(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'agentry-int-null-'));
    const target = join(workspaceRoot, 'node_modules', 'fake-null-default-adapter');
    await mkdir(target, { recursive: true });
    await cp(NULL_DEFAULT_FIXTURE, target, { recursive: true });
    await writeFile(join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'integ-ws-null' }));
    await mkdir(join(workspaceRoot, '.agentry'), { recursive: true });
    await writeFile(
      join(workspaceRoot, '.agentry', 'workspace.json'),
      JSON.stringify({ plugins: ['fake-null-default-adapter'], defaultEnv: 'dev' }),
    );
  });
  afterAll(async () => {
    if (workspaceRoot !== undefined) await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('reports a null-default adapter via manifest without surfacing loadErrors', async () => {
    const { stdout, exitCode } = await execa('node', [BIN, 'capabilities', '--json'], {
      cwd: workspaceRoot,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      categories: Record<string, { adapterId: string; pluginName: string }>;
      loadErrors: Array<{ name: string; code: string }>;
    };
    // Reported via manifest...
    expect(parsed.categories.db?.adapterId).toBe('fake-null-db');
    expect(parsed.categories.db?.pluginName).toBe('fake-null-default-adapter');
    // ...with no E_PLUGIN_BAD_EXPORT noise.
    expect(parsed.loadErrors).toEqual([]);
  });
});
