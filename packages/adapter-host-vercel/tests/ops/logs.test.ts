import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { VercelHostConfig } from '../../src/config.js';
import type { HostProject, IsoTimestamp, LogLine } from '@openagentry/core';
import { logs } from '../../src/ops/logs.js';

const BASE = 'https://api.vercel.com';

const cfg: VercelHostConfig = {
  token: 'tok_test',
  endpoint: BASE,
};

const project: HostProject = {
  id: 'prj_logs',
  name: 'log-app',
  slug: 'log-app',
  hostId: 'prj_logs',
  createdAt: '2026-01-01T00:00:00.000Z' as IsoTimestamp,
};

const DEPLOY_ID = 'dpl_abc123';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper — build a synthetic log entry
// ---------------------------------------------------------------------------

function makeEntry(opts: {
  id?: string;
  created: number;
  text: string;
  type?: string;
  requestId?: string;
}) {
  return {
    id: opts.id ?? `id-${opts.created}`,
    created: opts.created,
    text: opts.text,
    type: opts.type ?? 'stdout',
    requestId: opts.requestId,
  };
}

// ---------------------------------------------------------------------------
// Finite batch (tail: false)
// ---------------------------------------------------------------------------

describe('logs — finite batch', () => {
  it('yields entries and completes', async () => {
    const t0 = 1_700_000_000_000;

    server.use(
      http.get(`${BASE}/v3/deployments/${DEPLOY_ID}/events`, () =>
        HttpResponse.json([
          makeEntry({ created: t0, text: 'Starting build', type: 'stdout' }),
          makeEntry({ created: t0 + 100, text: 'Error: missing env', type: 'stderr' }),
          makeEntry({ created: t0 + 200, text: 'Done', type: 'stdout' }),
        ]),
      ),
    );

    const lines: LogLine[] = [];
    for await (const line of logs(cfg, project, { deploymentId: DEPLOY_ID, tail: false })) {
      lines.push(line);
    }

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ level: 'info', message: 'Starting build' });
    expect(lines[1]).toMatchObject({ level: 'error', message: 'Error: missing env' });
    expect(lines[2]).toMatchObject({ level: 'info', message: 'Done' });
  });

  it('maps log.created (epoch ms) to IsoTimestamp', async () => {
    const createdMs = 1_700_000_000_000;

    server.use(
      http.get(`${BASE}/v3/deployments/${DEPLOY_ID}/events`, () =>
        HttpResponse.json([makeEntry({ created: createdMs, text: 'hello' })]),
      ),
    );

    const lines: LogLine[] = [];
    for await (const line of logs(cfg, project, { deploymentId: DEPLOY_ID, tail: false })) {
      lines.push(line);
    }

    expect(lines[0]!.timestamp).toBe(new Date(createdMs).toISOString());
  });

  it('maps type "stderr" to level "error", others to "info"', async () => {
    server.use(
      http.get(`${BASE}/v3/deployments/${DEPLOY_ID}/events`, () =>
        HttpResponse.json([
          makeEntry({ created: 1000, text: 'cmd', type: 'command' }),
          makeEntry({ created: 2000, text: 'err', type: 'stderr' }),
          makeEntry({ created: 3000, text: 'out', type: 'stdout' }),
        ]),
      ),
    );

    const lines: LogLine[] = [];
    for await (const line of logs(cfg, project, { deploymentId: DEPLOY_ID, tail: false })) {
      lines.push(line);
    }

    expect(lines[0]!.level).toBe('info');   // command → info
    expect(lines[1]!.level).toBe('error');  // stderr → error
    expect(lines[2]!.level).toBe('info');   // stdout → info
  });

  it('yields nothing and completes on empty event list', async () => {
    server.use(
      http.get(`${BASE}/v3/deployments/${DEPLOY_ID}/events`, () => HttpResponse.json([])),
    );

    const lines: LogLine[] = [];
    for await (const line of logs(cfg, project, { deploymentId: DEPLOY_ID, tail: false })) {
      lines.push(line);
    }

    expect(lines).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deploymentId resolution
// ---------------------------------------------------------------------------

describe('logs — deploymentId resolution', () => {
  it('resolves latest deployment when deploymentId is omitted', async () => {
    let eventsCalledWith: string | undefined;

    server.use(
      http.get(`${BASE}/v6/deployments`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('projectId')).toBe(project.slug);
        expect(url.searchParams.get('limit')).toBe('1');
        return HttpResponse.json({ deployments: [{ uid: DEPLOY_ID }] });
      }),
      http.get(`${BASE}/v3/deployments/${DEPLOY_ID}/events`, () => {
        eventsCalledWith = DEPLOY_ID;
        return HttpResponse.json([makeEntry({ created: 1000, text: 'resolved' })]);
      }),
    );

    const lines: LogLine[] = [];
    for await (const line of logs(cfg, project, { tail: false })) {
      lines.push(line);
    }

    expect(eventsCalledWith).toBe(DEPLOY_ID);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.message).toBe('resolved');
  });

  it('throws E_VERCEL_NOT_FOUND when deployment list is empty', async () => {
    server.use(
      http.get(`${BASE}/v6/deployments`, () =>
        HttpResponse.json({ deployments: [] }),
      ),
    );

    const iter = logs(cfg, project, { tail: false })[Symbol.asyncIterator]();
    await expect(iter.next()).rejects.toMatchObject({ code: 'E_VERCEL_NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// Tail polling
// ---------------------------------------------------------------------------

describe('logs — tail polling', () => {
  it('yields initial batch then new entries from second poll', async () => {
    const t0 = 1_700_000_000_000;
    let callCount = 0;

    server.use(
      http.get(`${BASE}/v3/deployments/${DEPLOY_ID}/events`, () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json([
            makeEntry({ id: 'e1', created: t0, text: 'first' }),
          ]);
        }
        // Second poll returns one new entry and re-emits the boundary entry (should be deduped).
        return HttpResponse.json([
          makeEntry({ id: 'e1', created: t0, text: 'first' }), // duplicate
          makeEntry({ id: 'e2', created: t0 + 1000, text: 'second' }),
        ]);
      }),
    );

    const lines: LogLine[] = [];
    for await (const line of logs(cfg, project, { deploymentId: DEPLOY_ID, tail: true, pollMs: 10 })) {
      lines.push(line);
      if (lines.length === 2) break; // stop after getting 2 unique entries
    }

    expect(lines).toHaveLength(2);
    expect(lines[0]!.message).toBe('first');
    expect(lines[1]!.message).toBe('second');
    // Vercel re-yielded 'first' on second poll but seenIds deduped it.
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('does not re-yield entries with the same id across polls', async () => {
    const t0 = 1_700_000_000_000;
    let callCount = 0;

    server.use(
      http.get(`${BASE}/v3/deployments/${DEPLOY_ID}/events`, () => {
        callCount++;
        // Each poll returns all entries seen so far (simulate Vercel cursor overlap).
        const entries = [];
        for (let i = 0; i < callCount; i++) {
          entries.push(makeEntry({ id: `e${i}`, created: t0 + i * 500, text: `entry-${i}` }));
        }
        return HttpResponse.json(entries);
      }),
    );

    const lines: LogLine[] = [];
    for await (const line of logs(cfg, project, { deploymentId: DEPLOY_ID, tail: true, pollMs: 10 })) {
      lines.push(line);
      if (lines.length === 3) break;
    }

    // Should see entry-0, entry-1, entry-2 exactly once each.
    expect(lines.map((l) => l.message)).toEqual(['entry-0', 'entry-1', 'entry-2']);
  });
});
