/**
 * Format SuiteResult for humans (text) or machines (JSON).
 *
 * @module
 */

import type { CheckResult, SuiteResult } from './types.js';

const MARKER: Record<CheckResult['status'], string> = {
  pass: '✓',
  fail: '✗',
  skip: '·',
};

export function formatText(r: SuiteResult): string {
  const lines: string[] = [];
  lines.push(`${r.adapter.category} adapter ${r.adapter.id}@${r.adapter.version}`);
  for (const c of r.checks) {
    const head = `${MARKER[c.status]} ${c.id}`;
    if (c.status === 'fail' && c.message !== undefined) {
      lines.push(`${head} — ${c.message}`);
    } else {
      lines.push(head);
    }
  }
  lines.push(
    `${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped (total ${r.total})`,
  );
  return lines.join('\n');
}

export function formatJson(r: SuiteResult): string {
  return JSON.stringify(r, null, 2);
}
