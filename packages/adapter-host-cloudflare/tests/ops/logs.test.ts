import { describe, it, expect } from 'vitest';
import type { HostProject, IsoTimestamp } from '@openagentry/core';
import { cloudflareApi } from '../../src/client.js';
import { logs } from '../../src/ops/logs.js';
import { makeMockFetch } from '../helpers/mock-fetch.js';

const baseConfig = {
  apiToken: 't',
  accountId: '0123456789abcdef0123456789abcdef',
  apiBase: 'https://api.cloudflare.com/client/v4',
} as const;

const proj: HostProject = {
  id: 'p',
  hostId: 'p',
  name: 'My Site',
  slug: 'my-site',
  createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
};

describe('logs', () => {
  it('yields log lines from a single fetch when tail is not set', async () => {
    const { fetch } = makeMockFetch({
      body: {
        success: true,
        errors: [],
        messages: [],
        result: {
          data: [
            { ts: '2026-05-05T12:00:00Z', line: 'starting build' },
            { ts: '2026-05-05T12:00:01Z', line: 'build succeeded' },
          ],
          total: 2,
          includes_container_logs: false,
        },
      },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });

    const out: string[] = [];
    for await (const line of logs(api, proj, { deploymentId: 'dep-1' })) {
      out.push(line.message);
    }
    expect(out).toEqual(['starting build', 'build succeeded']);
  });

  it('resolves the latest deployment when deploymentId is not provided', async () => {
    const latestDep = {
      id: 'dep-latest',
      short_id: 'latest',
      project_id: 'p',
      project_name: 'my-site',
      environment: 'preview',
      url: 'https://dep-latest.my-site.pages.dev',
      created_on: '2026-05-05T12:00:00Z',
      modified_on: '2026-05-05T12:00:00Z',
    };
    const { fetch, calls } = makeMockFetch(
      {
        body: {
          success: true,
          errors: [],
          messages: [],
          result: [latestDep],
          result_info: { total_count: 1 },
        },
      },
      {
        body: {
          success: true,
          errors: [],
          messages: [],
          result: {
            data: [{ ts: '2026-05-05T12:00:00Z', line: 'hello' }],
            total: 1,
            includes_container_logs: false,
          },
        },
      },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    const out: string[] = [];
    for await (const line of logs(api, proj)) out.push(line.message);
    expect(out).toEqual(['hello']);
    expect(calls[0]?.url).toContain('/pages/projects/my-site/deployments?');
    expect(calls[1]?.url).toContain('/deployments/dep-latest/history/logs');
  });

  it('yields only new entries on tail polls until consumer breaks', async () => {
    const { fetch } = makeMockFetch(
      {
        body: {
          success: true,
          errors: [],
          messages: [],
          result: {
            data: [{ ts: '2026-05-05T12:00:00Z', line: 'one' }],
            total: 1,
            includes_container_logs: false,
          },
        },
      },
      {
        body: {
          success: true,
          errors: [],
          messages: [],
          result: {
            data: [
              { ts: '2026-05-05T12:00:00Z', line: 'one' },
              { ts: '2026-05-05T12:00:02Z', line: 'two' },
            ],
            total: 2,
            includes_container_logs: false,
          },
        },
      },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    const out: string[] = [];
    for await (const line of logs(api, proj, { deploymentId: 'dep-1', tail: true, pollMs: 0 } as { deploymentId: string; tail: boolean; pollMs: number })) {
      out.push(line.message);
      if (out.length === 2) break;
    }
    expect(out).toEqual(['one', 'two']);
  });
});
