import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSuite } from '../src/runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const goodHost = join(__dirname, 'fixtures', 'good-host');
const badHost = join(__dirname, 'fixtures', 'bad-host');

describe('runSuite', () => {
  it('runs universal-only against good-host and passes all 4 universal checks', async () => {
    const r = await runSuite({ target: goodHost, universalOnly: true });
    expect(r.adapter.id).toBe('good-host');
    expect(r.adapter.category).toBe('host');
    expect(r.total).toBe(4);
    expect(r.passed).toBe(4);
    expect(r.failed).toBe(0);
    const ids = r.checks.map((c) => c.id);
    expect(ids).toEqual([
      'manifest/valid',
      'manifest/protocol-compatible',
      'ai-friendly/flags',
      'docs/llm-md',
    ]);
  });

  it('runs universal-only against bad-host and reports the expected failures', async () => {
    const r = await runSuite({ target: badHost, universalOnly: true });
    expect(r.adapter.id).toBe('bad-host');
    expect(r.failed).toBeGreaterThanOrEqual(2);
    const failed = r.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    expect(failed).toContain('ai-friendly/flags');
    expect(failed).toContain('docs/llm-md');
  });

  it('rejects when category override does not match manifest', async () => {
    await expect(runSuite({ target: goodHost, category: 'storage' })).rejects.toThrow(
      /category/,
    );
  });

  it('stamps adapter.version from package.json', async () => {
    const r = await runSuite({ target: goodHost, universalOnly: true });
    expect(r.adapter.version).toBe('1.0.0');
  });

  it('startedAt and finishedAt are ISO-8601 strings', async () => {
    const r = await runSuite({ target: goodHost, universalOnly: true });
    expect(r.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
