/**
 * Streaming + history logs for a Vercel deployment.
 *
 * @module
 */

import type { HostProject, IsoTimestamp, LogLine, LogOpts } from '@openagentry/core';
import type { VercelHostConfig } from '../config.js';
import { vercelFetch } from '../http.js';
import { vercelError, VERCEL_ERROR_CODES } from '../errors.js';

/** Extended opts — internal `pollMs` override for fast tests. */
interface ExtendedLogOpts extends LogOpts {
  /**
   * Polling interval in ms when tail is true. Defaults to 2000.
   * Internal / test-only — not part of the public LogOpts surface.
   */
  pollMs?: number;
}

/** A single entry from GET /v3/deployments/{id}/events */
interface VercelLogEntry {
  id?: string;
  created: number; // epoch ms
  text: string;
  type: string; // e.g. 'stdout', 'stderr', 'command', etc.
  requestId?: string;
}

/** Minimal deployment shape from GET /v6/deployments */
interface VercelDeploymentListItem {
  uid: string;
  id?: string;
}

/** Response envelope from GET /v6/deployments */
interface VercelDeploymentListResponse {
  deployments: VercelDeploymentListItem[];
}

async function resolveDeploymentId(
  cfg: VercelHostConfig,
  p: HostProject,
): Promise<string> {
  const resp = await vercelFetch(
    cfg,
    'GET',
    `/v6/deployments?projectId=${encodeURIComponent(p.slug)}&limit=1`,
    undefined,
    'logs',
  );
  const body = resp.json as VercelDeploymentListResponse;
  const first = body.deployments[0];
  if (first === undefined) {
    throw vercelError({
      code: VERCEL_ERROR_CODES.NOT_FOUND,
      phase: 'logs',
      message: 'No deployments found for this project.',
      suggestedFix:
        'Deploy the project at least once before streaming logs.',
    });
  }
  // Vercel uses both 'uid' and 'id' depending on API version — prefer uid.
  const depId = first.uid ?? first.id;
  if (depId === undefined) {
    throw vercelError({
      code: VERCEL_ERROR_CODES.NOT_FOUND,
      phase: 'logs',
      message: 'Deployment has no id.',
      suggestedFix: 'Unexpected Vercel API response shape — check API version.',
    });
  }
  return depId;
}

function mapEntry(entry: VercelLogEntry): LogLine {
  return {
    timestamp: new Date(entry.created).toISOString() as IsoTimestamp,
    level: entry.type === 'stderr' ? 'error' : 'info',
    message: entry.text,
    ...(entry.requestId !== undefined ? { meta: { requestId: entry.requestId } } : {}),
  };
}

async function fetchEvents(
  cfg: VercelHostConfig,
  deploymentId: string,
  since: number,
): Promise<VercelLogEntry[]> {
  const resp = await vercelFetch(
    cfg,
    'GET',
    `/v3/deployments/${encodeURIComponent(deploymentId)}/events?since=${since}&limit=1000`,
    undefined,
    'logs',
  );
  const entries = resp.json;
  return Array.isArray(entries) ? (entries as VercelLogEntry[]) : [];
}

/**
 * Returns an async iterable of log lines for a Vercel deployment.
 *
 * - `opts.deploymentId`: use this deployment; if omitted, resolves the latest.
 * - `opts.tail`: if false/unset, yields one batch then completes. If true, polls.
 * - `opts.since`: ISO timestamp — only yield entries created after this time.
 */
export function logs(
  cfg: VercelHostConfig,
  p: HostProject,
  opts?: ExtendedLogOpts,
): AsyncIterable<LogLine> {
  const tail = opts?.tail === true;
  const pollMs = opts?.pollMs ?? 2000;
  const sinceMs = opts?.since !== undefined ? new Date(opts.since).getTime() : 0;

  return {
    [Symbol.asyncIterator](): AsyncIterator<LogLine> {
      let deploymentId: string | undefined = opts?.deploymentId;
      const seenIds = new Set<string>();
      let pendingBatch: LogLine[] = [];
      let lastCreatedMs: number = sinceMs;
      let started = false;
      let stopped = false;

      function entryKey(e: VercelLogEntry): string {
        // Prefer explicit id; fall back to created+text for dedup.
        return e.id ?? `${e.created}::${e.text}`;
      }

      const fillBatch = async (): Promise<void> => {
        if (deploymentId === undefined) {
          deploymentId = await resolveDeploymentId(cfg, p);
        }
        const entries = await fetchEvents(cfg, deploymentId, lastCreatedMs);
        for (const entry of entries) {
          const key = entryKey(entry);
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          if (entry.created > lastCreatedMs) {
            lastCreatedMs = entry.created;
          }
          pendingBatch.push(mapEntry(entry));
        }
      };

      return {
        async next(): Promise<IteratorResult<LogLine>> {
          if (stopped) return { value: undefined as unknown as LogLine, done: true };

          if (!started) {
            started = true;
            await fillBatch();
          }

          // If the pending batch is empty, decide whether to poll or stop.
          while (pendingBatch.length === 0) {
            if (!tail) return { value: undefined as unknown as LogLine, done: true };
            if (pollMs > 0) {
              await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
            }
            await fillBatch();
          }

          const line = pendingBatch.shift()!;
          return { value: line, done: false };
        },

        async return(): Promise<IteratorResult<LogLine>> {
          stopped = true;
          return { value: undefined as unknown as LogLine, done: true };
        },
      };
    },
  };
}
