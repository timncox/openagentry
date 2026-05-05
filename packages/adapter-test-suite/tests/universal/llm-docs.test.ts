import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { checkLlmDocs } from '../../src/universal/llm-docs.js';
import type { LoadedTarget } from '../../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function targetWith(packageDir: string): LoadedTarget {
  return {
    packageDir,
    manifest: {
      type: 'adapter',
      id: 'fake',
      category: 'host',
      protocolVersion: '1',
      envVars: [],
      fillsSlots: [],
      requiresSlots: [],
      capabilities: {},
      aiFriendly: { structuredErrors: true, dryRun: false, idempotent: [], queryableState: true },
    },
    module: {},
  };
}

describe('checkLlmDocs', () => {
  it('passes for the good-host fixture LLM.md', async () => {
    const goodHost = join(__dirname, '..', 'fixtures', 'good-host');
    const checks = await checkLlmDocs(targetWith(goodHost), { now: () => 0 });
    expect(checks).toHaveLength(1);
    expect(checks[0]?.id).toBe('docs/llm-md');
    expect(checks[0]?.status).toBe('pass');
  });

  it('fails when LLM.md is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ats-'));
    try {
      const checks = await checkLlmDocs(targetWith(dir), { now: () => 0 });
      expect(checks[0]?.status).toBe('fail');
      expect(checks[0]?.message).toMatch(/LLM\.md not found/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails when LLM.md is shorter than 100 chars', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ats-'));
    try {
      await writeFile(join(dir, 'LLM.md'), '# tiny\n');
      const checks = await checkLlmDocs(targetWith(dir), { now: () => 0 });
      expect(checks[0]?.status).toBe('fail');
      expect(checks[0]?.message).toContain('100');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails when LLM.md exceeds 1024 tokens (>4096 chars)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ats-'));
    try {
      const big = '# header\n\n## A\n\n' + 'x'.repeat(5000) + '\n\n## B\n\nmore\n';
      await writeFile(join(dir, 'LLM.md'), big);
      const checks = await checkLlmDocs(targetWith(dir), { now: () => 0 });
      expect(checks[0]?.status).toBe('fail');
      expect(checks[0]?.message).toContain('1024');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails when LLM.md has fewer than 2 H2 sections', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ats-'));
    try {
      const oneSection =
        '# title\n\n## Operations\n\n' +
        'Some sufficiently long body text that pushes us above the 100-char minimum so the only failure is the section count.\n';
      await writeFile(join(dir, 'LLM.md'), oneSection);
      const checks = await checkLlmDocs(targetWith(dir), { now: () => 0 });
      expect(checks[0]?.status).toBe('fail');
      expect(checks[0]?.message).toMatch(/H2 sections/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
