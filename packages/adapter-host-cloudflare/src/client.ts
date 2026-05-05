/**
 * Thin Cloudflare REST API client.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import { type CloudflareConfig, parseCloudflareConfig } from './config.js';
import { cfErrorFromCause, cfErrorFromHttp, cfErrorFromResponse } from './errors.js';
import type { CfApiResponse } from './types.js';

export interface CloudflareApiInput extends Partial<CloudflareConfig> {
  apiToken: string;
  accountId: string;
  /** Inject a fetch implementation (tests). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
}

export interface RequestOpts {
  phase: AgentryErrorPhase;
  /** JSON-serializable body. Mutually exclusive with `bodyBytes`. */
  json?: unknown;
  /** Raw body bytes (for asset upload). */
  bodyBytes?: Uint8Array;
  /** Override Content-Type (defaults to application/json when `json` is set). */
  contentType?: string;
  /** Extra headers to attach. */
  headers?: Record<string, string>;
}

export interface CloudflareApi {
  /** Substitute the first `{account_id}` in the path template, perform the request, return parsed result. */
  request<T = unknown>(method: string, pathTemplate: string, opts: RequestOpts): Promise<T>;
  readonly config: CloudflareConfig;
}

const RETRY_LIMIT = 1;

function buildUrl(config: CloudflareConfig, pathTemplate: string): string {
  const path = pathTemplate.replace('{account_id}', config.accountId);
  const base = config.apiBase.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function retryAfterMs(headerVal: string | null): number {
  if (headerVal === null) return 0;
  const n = Number(headerVal);
  if (Number.isFinite(n)) return Math.max(0, n) * 1000;
  return 0;
}

export function cloudflareApi(input: CloudflareApiInput): CloudflareApi {
  const { fetch: fetchImpl, ...rest } = input;
  const config = parseCloudflareConfig(rest);
  const fx = fetchImpl ?? globalThis.fetch;

  async function doRequest<T>(method: string, pathTemplate: string, opts: RequestOpts): Promise<T> {
    const url = buildUrl(config, pathTemplate);
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.apiToken}`,
      ...(opts.headers ?? {}),
    };
    let body: string | Uint8Array | undefined;
    if (opts.json !== undefined) {
      headers['content-type'] = opts.contentType ?? 'application/json';
      body = JSON.stringify(opts.json);
    } else if (opts.bodyBytes !== undefined) {
      headers['content-type'] = opts.contentType ?? 'application/octet-stream';
      body = opts.bodyBytes;
    }

    const initBase: RequestInit = { method, headers };
    const init: RequestInit = body !== undefined ? { ...initBase, body } : initBase;

    let attempt = 0;
    let lastResp: Response | null = null;
    while (attempt <= RETRY_LIMIT) {
      let resp: Response;
      try {
        resp = await fx(url, init);
      } catch (cause) {
        throw cfErrorFromCause(opts.phase, cause);
      }
      lastResp = resp;
      if (resp.status === 429 && attempt < RETRY_LIMIT) {
        const wait = retryAfterMs(resp.headers.get('retry-after'));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        attempt += 1;
        continue;
      }
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw cfErrorFromHttp(opts.phase, resp.status, text);
      }
      if (resp.status === 204) {
        return null as T;
      }
      const ct = resp.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        const text = await resp.text().catch(() => '');
        return text as unknown as T;
      }
      let parsed: CfApiResponse<T>;
      try {
        parsed = (await resp.json()) as CfApiResponse<T>;
      } catch (cause) {
        throw cfErrorFromCause(opts.phase, cause);
      }
      if (parsed.success === false) {
        throw cfErrorFromResponse(opts.phase, parsed);
      }
      return (parsed.result ?? null) as T;
    }
    // Defensive: with RETRY_LIMIT === 1 the inner !resp.ok branch always throws first.
    // This guards against future increases of RETRY_LIMIT that could exit the loop normally.
    const text = lastResp !== null ? await lastResp.text().catch(() => '') : '';
    throw cfErrorFromHttp(opts.phase, 429, text || 'rate limited');
  }

  return {
    request: doRequest,
    config,
  };
}
