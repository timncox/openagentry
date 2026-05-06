/**
 * Thin Neon Console REST API client.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import { type NeonConfig, parseNeonConfig } from './config.js';
import { neonErrorFromCause, neonErrorFromResponse } from './errors.js';
import type { NeonErrorBody } from './types.js';

export interface NeonApiInput extends Partial<NeonConfig> {
  apiKey: string;
  /** Inject a fetch implementation (tests). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
}

export interface RequestOpts {
  phase: AgentryErrorPhase;
  /** JSON-serializable body. */
  json?: unknown;
  /** Extra headers to attach. */
  headers?: Record<string, string>;
}

export interface NeonApi {
  request<T = unknown>(method: string, path: string, opts: RequestOpts): Promise<T>;
  readonly config: NeonConfig;
}

const RETRY_LIMIT = 1;

function buildUrl(config: NeonConfig, path: string): string {
  const base = config.apiBase.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function retryAfterMs(headerVal: string | null): number {
  if (headerVal === null) return 0;
  const n = Number(headerVal);
  if (Number.isFinite(n)) return Math.max(0, n) * 1000;
  return 0;
}

async function parseBody(resp: Response): Promise<unknown> {
  if (resp.status === 204) return null;
  const ct = resp.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }
  const text = await resp.text();
  return text.length === 0 ? null : { message: text };
}

export function neonApi(input: NeonApiInput): NeonApi {
  const { fetch: fetchImpl, ...rest } = input;
  const config = parseNeonConfig(rest);
  const fx = fetchImpl ?? globalThis.fetch;

  async function once(method: string, path: string, opts: RequestOpts): Promise<Response> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.apiKey}`,
      accept: 'application/json',
      ...opts.headers,
    };
    const init: RequestInit = { method, headers };
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(opts.json);
    }
    return fx(buildUrl(config, path), init);
  }

  return {
    config,
    async request<T>(method: string, path: string, opts: RequestOpts): Promise<T> {
      let attempts = 0;
      let resp: Response;
      try {
        resp = await once(method, path, opts);
        while (resp.status === 429 && attempts < RETRY_LIMIT) {
          attempts += 1;
          const wait = retryAfterMs(resp.headers.get('retry-after'));
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          resp = await once(method, path, opts);
        }
      } catch (cause) {
        throw neonErrorFromCause(opts.phase, cause);
      }
      if (resp.ok) {
        return (await parseBody(resp)) as T;
      }
      const body = (await parseBody(resp)) as NeonErrorBody | null;
      throw neonErrorFromResponse(opts.phase, resp.status, body);
    },
  };
}
