/**
 * Single HTTP chokepoint for the Vercel REST API.
 *
 * All Vercel API calls in this adapter pass through `vercelFetch`.
 * It sets Bearer auth headers, appends the teamId query param when configured,
 * serializes an optional JSON body, fires `fetch`, reads the response, and
 * translates HTTP failures and network errors into AgentryError.
 *
 * Per-op files (projects.ts, deploy.ts, env.ts, domains.ts, logs.ts,
 * state.ts) call this function and never import `fetch` directly.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import type { VercelHostConfig } from './config.js';
import { networkErr, httpToVercelError, vercelError, VERCEL_ERROR_CODES } from './errors.js';

export interface VercelResponse {
  status: number;
  headers: Headers;
  json: unknown | null;
}

/**
 * Append `teamId` as a query param to a URL string.
 *
 * If the URL already contains a `?`, the param is appended with `&`.
 * Otherwise it is appended with `?`.
 */
function appendTeamId(url: string, teamId: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}teamId=${encodeURIComponent(teamId)}`;
}

/**
 * Convert a `Headers` object to a plain `Record<string, string | null>` so it
 * can be passed to `httpToVercelError`. Only the headers we care about for
 * error mapping need to be extracted (e.g. `retry-after`).
 */
function headersToRecord(headers: Headers): Record<string, string | null> {
  const record: Record<string, string | null> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

/**
 * Fire a Vercel REST API call and return the parsed response.
 *
 * @param cfg    - Validated adapter config (token, optional teamId + endpoint).
 * @param method - HTTP method: GET, POST, DELETE, or PATCH.
 * @param path   - URL path segment, e.g. `/v9/projects/{idOrName}`. Must start with `/`.
 * @param body   - Optional request body, serialized as JSON when present.
 * @param phase  - `AgentryErrorPhase` to attach to any thrown `AgentryError`.
 *
 * @returns Parsed response object with `status`, `headers`, and `json`.
 *          `json` is `null` for 204 / 205 No Content responses.
 *
 * @throws `AgentryError` with `E_VERCEL_NETWORK` on fetch-level failure.
 * @throws `AgentryError` with an appropriate code on non-ok HTTP response.
 */
export async function vercelFetch(
  cfg: VercelHostConfig,
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  path: string,
  body: object | undefined,
  phase: AgentryErrorPhase,
): Promise<VercelResponse> {
  let url = `${cfg.endpoint}${path}`;

  // Scope all API calls to the configured team when teamId is present.
  if (cfg.teamId) {
    url = appendTeamId(url, cfg.teamId);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
  };

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  // Fire the request — translate fetch-level errors to E_VERCEL_NETWORK.
  let response: Response;
  try {
    response = await fetch(url, requestInit);
  } catch (cause) {
    throw networkErr(cause, phase);
  }

  // 204 No Content and 205 Reset Content have no body — json stays null.
  let json: unknown | null = null;
  if (response.status !== 204 && response.status !== 205) {
    try {
      json = await response.json();
    } catch (cause) {
      // Malformed JSON from a server that reported ok — treat as upstream error.
      if (response.ok) {
        throw vercelError({
          code: VERCEL_ERROR_CODES.UPSTREAM,
          message: `Vercel API returned non-JSON body (HTTP ${response.status})`,
          phase,
          suggestedFix:
            'The Vercel API returned a response body that could not be parsed as JSON. ' +
            'Check Vercel API status at https://www.vercel-status.com/',
          context: {
            httpStatus: response.status,
            parseError: cause instanceof Error ? cause.message : String(cause),
          },
          cause: cause instanceof Error ? cause : undefined,
        });
      }
      // For non-ok responses with broken JSON, fall through to httpToVercelError
      // with null body — it has no usable message anyway.
    }
  }

  // Translate non-ok HTTP responses to AgentryError.
  if (!response.ok) {
    throw httpToVercelError(
      response.status,
      json as { error?: { code?: string; message?: string } } | null,
      headersToRecord(response.headers),
      phase,
    );
  }

  return { status: response.status, headers: response.headers, json };
}
