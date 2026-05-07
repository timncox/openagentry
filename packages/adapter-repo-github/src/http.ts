/**
 * Single HTTP chokepoint for the GitHub REST API.
 *
 * All GitHub API calls in this adapter pass through `githubFetch`.
 * It sets required auth + versioning headers, serializes an optional JSON
 * body, fires `fetch`, reads the response, and translates HTTP failures and
 * network errors into AgentryError.
 *
 * Per-op files (create.ts, delete.ts, get.ts) call this function and never
 * import `fetch` directly.
 *
 * `remote-url.ts` is purely string formatting and does not go through here.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import type { GithubRepoConfig } from './config.js';
import { networkErr, httpToGithubError, githubError, GITHUB_ERROR_CODES } from './errors.js';

const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_ACCEPT = 'application/vnd.github+json';

export interface GithubResponse {
  status: number;
  headers: Headers;
  json: unknown | null;
}

/**
 * Fire a GitHub REST API call and return the parsed response.
 *
 * @param cfg    - Validated adapter config (token + endpoint).
 * @param method - HTTP method: GET, POST, DELETE, or PATCH.
 * @param path   - URL path segment, e.g. `/repos/{owner}/{name}`. Must start with `/`.
 * @param body   - Optional request body, serialized as JSON when present.
 * @param phase  - `AgentryErrorPhase` to attach to any thrown `AgentryError`.
 *
 * @returns Parsed response object with `status`, `headers`, and `json`.
 *          `json` is `null` for 204 No Content or HEAD responses.
 *
 * @throws `AgentryError` with `E_GITHUB_NETWORK` on fetch-level failure.
 * @throws `AgentryError` with an appropriate code on non-ok HTTP response.
 */
export async function githubFetch(
  cfg: GithubRepoConfig,
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  path: string,
  body: object | undefined,
  phase: AgentryErrorPhase,
): Promise<GithubResponse> {
  const url = `${cfg.endpoint}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: GITHUB_ACCEPT,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  // Fire the request — translate fetch-level errors to E_GITHUB_NETWORK.
  let response: Response;
  try {
    response = await fetch(url, requestInit);
  } catch (cause) {
    throw networkErr(cause, phase);
  }

  // 204 No Content responses have no body — json stays null.
  let json: unknown | null = null;
  if (response.status !== 204) {
    try {
      json = await response.json();
    } catch (cause) {
      // Malformed JSON from a server that reported ok — treat as upstream error.
      if (response.ok) {
        throw githubError({
          code: GITHUB_ERROR_CODES.UPSTREAM,
          message: `GitHub API returned non-JSON body (HTTP ${response.status})`,
          phase,
          suggestedFix:
            'The GitHub API returned a response body that could not be parsed as JSON. Check GitHub API status at https://www.githubstatus.com/',
          context: {
            httpStatus: response.status,
            parseError: cause instanceof Error ? cause.message : String(cause),
          },
          cause: cause instanceof Error ? cause : undefined,
        });
      }
      // For non-ok responses with broken JSON, fall through to httpToGithubError
      // with null body — it has no usable message anyway.
    }
  }

  // Translate non-ok HTTP responses to AgentryError.
  if (!response.ok) {
    const headersMap: Record<string, string | null> = {};
    response.headers.forEach((value, key) => {
      headersMap[key.toLowerCase()] = value;
    });
    throw httpToGithubError(response.status, json as { message?: string; errors?: unknown[] } | null, headersMap, phase);
  }

  return { status: response.status, headers: response.headers, json };
}
