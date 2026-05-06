import { describe, expect, it } from 'vitest';
import { writeFileSync, chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isAgentryError } from '@openagentry/core';
import { defaultSpawn, resolveBinary } from '../src/exec.js';

describe('defaultSpawn', () => {
  it('runs a real binary and emits exit', async () => {
    const child = defaultSpawn('node', ['-e', 'process.exit(0)'], {});
    const code = await new Promise<number | null>((res) => {
      child.on('exit', res);
    });
    expect(code).toBe(0);
  });

  it('passes env to the child process', async () => {
    const child = defaultSpawn(
      'node',
      ['-e', 'process.stdout.write(process.env.OA_TEST_VAR ?? "")'],
      { env: { OA_TEST_VAR: 'hello' } },
    );
    let stdout = '';
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    await new Promise<void>((res) => {
      child.on('exit', () => res());
    });
    expect(stdout).toBe('hello');
  });
});

describe('resolveBinary', () => {
  it('returns binPath when it exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-llm-cli-'));
    const binPath = join(dir, 'fake-cli');
    writeFileSync(binPath, '#!/bin/sh\necho hi\n');
    chmodSync(binPath, 0o755);
    try {
      expect(resolveBinary('claude', binPath)).toBe(binPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws E_LLM_CLI_NOT_FOUND when binPath does not exist', () => {
    try {
      resolveBinary('claude', '/nonexistent/path/fake-cli');
      throw new Error('expected throw');
    } catch (err) {
      expect(isAgentryError(err)).toBe(true);
      expect((err as { code: string }).code).toBe('E_LLM_CLI_NOT_FOUND');
    }
  });

  it('walks PATH and finds a binary', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-llm-cli-'));
    const binPath = join(dir, 'fake-claude');
    writeFileSync(binPath, '#!/bin/sh\necho hi\n');
    chmodSync(binPath, 0o755);
    const oldPath = process.env['PATH'];
    process.env['PATH'] = dir;
    try {
      expect(resolveBinary('fake-claude')).toBe(binPath);
    } finally {
      process.env['PATH'] = oldPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws when binary is not on PATH', () => {
    const oldPath = process.env['PATH'];
    process.env['PATH'] = '/nonexistent';
    try {
      resolveBinary('definitely-not-a-real-bin-xyz');
      throw new Error('expected throw');
    } catch (err) {
      expect(isAgentryError(err)).toBe(true);
      expect((err as { code: string }).code).toBe('E_LLM_CLI_NOT_FOUND');
    } finally {
      process.env['PATH'] = oldPath;
    }
  });
});
