/**
 * Build OpenRouter request headers from config — shared by all ops.
 *
 * Always: `Authorization`, `Content-Type` (when method has a body).
 * Conditionally: `HTTP-Referer` and `X-OpenRouter-Title` if cfg.appUrl /
 * cfg.appTitle are set.
 *
 * @module
 */

import type { OpenrouterLlmConfig } from './config.js';

export function buildHeaders(cfg: OpenrouterLlmConfig, opts?: { json?: boolean }): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (opts?.json === true) {
    headers['Content-Type'] = 'application/json';
  }
  if (cfg.appUrl !== undefined) {
    headers['HTTP-Referer'] = cfg.appUrl;
  }
  if (cfg.appTitle !== undefined) {
    headers['X-OpenRouter-Title'] = cfg.appTitle;
  }
  return headers;
}
