/**
 * Streaming + history logs for a Pages deployment.
 *
 * @module
 */

import type {
  HostProject,
  IsoTimestamp,
  LogLine,
  LogOpts,
} from '@openagentry/core';
import type { CloudflareApi } from '../client.js';
import type { CfPagesDeployment, CfPagesDeploymentLog } from '../types.js';

interface CfHistoryResponse {
  data: CfPagesDeploymentLog[];
  total: number;
  includes_container_logs: boolean;
}

interface ExtendedLogOpts extends LogOpts {
  /** Polling interval when tail is true. Defaults to 2000 ms. Internal/test only. */
  pollMs?: number;
}

async function resolveLatestDeploymentId(
  api: CloudflareApi,
  project: HostProject,
): Promise<string> {
  const list = await api.request<CfPagesDeployment[]>(
    'GET',
    `/accounts/{account_id}/pages/projects/${project.slug}/deployments?per_page=1`,
    { phase: 'logs' },
  );
  if (!Array.isArray(list) || list.length === 0 || list[0] === undefined) {
    throw new Error('No deployments found for this project.');
  }
  return list[0].id;
}

async function fetchHistory(
  api: CloudflareApi,
  project: HostProject,
  deploymentId: string,
): Promise<CfPagesDeploymentLog[]> {
  const result = await api.request<CfHistoryResponse>(
    'GET',
    `/accounts/{account_id}/pages/projects/${project.slug}/deployments/${deploymentId}/history/logs`,
    { phase: 'logs' },
  );
  return result.data;
}

function entryToLogLine(entry: CfPagesDeploymentLog): LogLine {
  return {
    timestamp: entry.ts as IsoTimestamp,
    level: 'info',
    message: entry.line,
  };
}

export function logs(
  api: CloudflareApi,
  project: HostProject,
  opts?: ExtendedLogOpts,
): AsyncIterable<LogLine> {
  const tail = opts?.tail === true;
  const pollMs = opts?.pollMs ?? 2000;

  return {
    [Symbol.asyncIterator](): AsyncIterator<LogLine> {
      let deploymentId = opts?.deploymentId;
      const seen = new Set<string>();
      let pendingBatch: LogLine[] = [];
      let started = false;
      let stopped = false;

      const fillBatch = async (): Promise<void> => {
        if (deploymentId === undefined) {
          deploymentId = await resolveLatestDeploymentId(api, project);
        }
        const entries = await fetchHistory(api, project, deploymentId);
        for (const e of entries) {
          const key = `${e.ts}::${e.line}`;
          if (!seen.has(key)) {
            seen.add(key);
            pendingBatch.push(entryToLogLine(e));
          }
        }
      };

      return {
        async next(): Promise<IteratorResult<LogLine>> {
          if (stopped) return { value: undefined, done: true };
          if (!started) {
            started = true;
            await fillBatch();
          }
          while (pendingBatch.length === 0) {
            if (!tail) return { value: undefined, done: true };
            if (pollMs > 0) await new Promise((r) => setTimeout(r, pollMs));
            await fillBatch();
          }
          const next = pendingBatch.shift()!;
          return { value: next, done: false };
        },
        async return(): Promise<IteratorResult<LogLine>> {
          stopped = true;
          return { value: undefined, done: true };
        },
      };
    },
  };
}
