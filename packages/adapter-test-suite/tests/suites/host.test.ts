import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSuite } from '../../src/runner.js';
import '../../src/suites/host.js'; // side-effect: registers the host functional suite

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const goodHost = join(__dirname, '..', 'fixtures', 'good-host');
const badHost = join(__dirname, '..', 'fixtures', 'bad-host');

describe('host functional suite — good-host', () => {
  it('runs all 5 functional checks and they all pass', async () => {
    const r = await runSuite({ target: goodHost });
    const fnIds = r.checks
      .filter((c) => c.id.startsWith('host/'))
      .map((c) => c.id)
      .sort();
    expect(fnIds).toEqual([
      'host/createProject',
      'host/exportState-importState',
      'host/getEnv-roundtrip',
      'host/setEnv-idempotent',
      'host/structured-errors',
    ]);
    expect(r.checks.filter((c) => c.id.startsWith('host/') && c.status === 'pass')).toHaveLength(5);
  });

  it('total == 4 universal + 5 functional == 9, all pass', async () => {
    const r = await runSuite({ target: goodHost });
    expect(r.total).toBe(9);
    expect(r.passed).toBe(9);
  });
});

describe('host functional suite — bad-host', () => {
  it('reports failures on functional checks (bad-host adapter is incomplete)', async () => {
    const r = await runSuite({ target: badHost });
    const fnFails = r.checks.filter((c) => c.id.startsWith('host/') && c.status === 'fail');
    expect(fnFails.length).toBeGreaterThanOrEqual(1);
  });

  it('host/createProject fails because bad-host throws plain Error from createProject', async () => {
    const r = await runSuite({ target: badHost });
    const c = r.checks.find((x) => x.id === 'host/createProject');
    expect(c?.status).toBe('fail');
  });
});
