/**
 * Lifecycle hooks. init/refresh are no-ops at v0; auth + healthcheck both
 * verify the Neon API key via /users/me.
 *
 * Phase 'auth' IS in core's AgentryErrorPhase union — no cast workaround
 * needed for this file.
 *
 * @module
 */

import { isAgentryError } from '@openagentry/core';
import type { NeonApi } from './client.js';

export interface AuthResult {
  ok: boolean;
  message?: string;
}

export interface HealthcheckResult {
  status: 'healthy' | 'unhealthy';
  message?: string;
}

export async function init(_api: NeonApi): Promise<void> {
  // No local state to initialize at v0.
}

export async function refresh(_api: NeonApi): Promise<void> {
  // No local state to refresh at v0.
}

export async function auth(api: NeonApi): Promise<AuthResult> {
  try {
    await api.request<{ id: string }>('GET', '/users/me', { phase: 'auth' });
    return { ok: true };
  } catch (err) {
    if (isAgentryError(err)) return { ok: false, message: err.message };
    return { ok: false, message: (err as Error).message };
  }
}

export async function healthcheck(api: NeonApi): Promise<HealthcheckResult> {
  const result = await auth(api);
  if (result.ok) return { status: 'healthy' };
  const unhealthy: HealthcheckResult = { status: 'unhealthy' };
  if (result.message !== undefined) unhealthy.message = result.message;
  return unhealthy;
}
