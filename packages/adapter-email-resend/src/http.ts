/**
 * Single chokepoint for HTTP calls to the Resend API. Everything the adapter
 * sends to Resend goes through `resendFetch`. Adds auth + content-type
 * headers, translates failures to AgentryError.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import type { ResendEmailConfig } from './config.js';
import { httpToResendError, networkErr } from './errors.js';

export async function resendFetch(
  cfg: ResendEmailConfig,
  path: string,
  init: RequestInit,
  phase: AgentryErrorPhase,
): Promise<Response> {
  const url = `${cfg.endpoint}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${cfg.apiKey}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (cause) {
    throw networkErr(cause, phase);
  }

  if (!res.ok) {
    throw await httpToResendError(res, phase);
  }
  return res;
}
