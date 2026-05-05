import { describe, expect, it } from 'vitest';
import { formatText, formatJson } from '../src/reporter.js';
import type { SuiteResult } from '../src/types.js';
import type { IsoTimestamp } from '@openagentry/core';

const sample: SuiteResult = {
  adapter: { id: 'fake', category: 'host', version: '1.0.0' },
  passed: 2,
  failed: 1,
  skipped: 0,
  total: 3,
  checks: [
    { id: 'manifest/valid', status: 'pass', durationMs: 4 },
    { id: 'docs/llm-md', status: 'pass', durationMs: 7 },
    {
      id: 'ai-friendly/flags',
      status: 'fail',
      message: 'aiFriendly.queryableState must be true',
      durationMs: 1,
    },
  ],
  startedAt: '2026-05-04T00:00:00Z' as IsoTimestamp,
  finishedAt: '2026-05-04T00:00:01Z' as IsoTimestamp,
};

describe('formatText', () => {
  it('prints one line per check with ✓ / ✗ markers', () => {
    const out = formatText(sample);
    expect(out).toContain('✓ manifest/valid');
    expect(out).toContain('✓ docs/llm-md');
    expect(out).toContain('✗ ai-friendly/flags');
  });

  it('includes failure messages on failing checks', () => {
    const out = formatText(sample);
    expect(out).toContain('aiFriendly.queryableState must be true');
  });

  it('renders a summary line', () => {
    const out = formatText(sample);
    expect(out).toMatch(/2 passed, 1 failed.*total 3/);
  });

  it('prints adapter identity at the top', () => {
    const out = formatText(sample);
    expect(out).toContain('host');
    expect(out).toContain('fake');
  });
});

describe('formatJson', () => {
  it('round-trips the SuiteResult exactly', () => {
    const json = formatJson(sample);
    expect(JSON.parse(json)).toEqual(sample);
  });

  it('produces stable, indented output', () => {
    const json = formatJson(sample);
    expect(json.startsWith('{\n')).toBe(true);
  });
});
