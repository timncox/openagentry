/**
 * Lifecycle hooks. init/refresh are no-ops at v0; auth + healthcheck both
 * verify the Cloudflare API token via /user/tokens/verify.
 *
 * @module
 */

import { isAgentryError } from '@openagentry/core';
import type { CloudflareApi } from './client.js';

export interface AuthResult {
  ok: boolean;
  message?: string;
}

export interface HealthcheckResult {
  status: 'healthy' | 'unhealthy';
  message?: string;
}

export async function init(_api: CloudflareApi): Promise<void> {
  // No local state to initialize at v0.
}

export async function refresh(_api: CloudflareApi): Promise<void> {
  // No local state to refresh at v0.
}

export async function auth(api: CloudflareApi): Promise<AuthResult> {
  try {
    const result = await api.request<{ id: string; status: string }>('GET', '/user/tokens/verify', {
      phase: 'auth',
    });
    if (result?.status === 'active') return { ok: true };
    return { ok: false, message: `Cloudflare token status: ${result?.status ?? 'unknown'}` };
  } catch (err) {
    if (isAgentryError(err)) return { ok: false, message: err.message };
    return { ok: false, message: (err as Error).message };
  }
}

export async function healthcheck(api: CloudflareApi): Promise<HealthcheckResult> {
  const result = await auth(api);
  if (result.ok) return { status: 'healthy' };
  const unhealthy: HealthcheckResult = { status: 'unhealthy' };
  if (result.message !== undefined) unhealthy.message = result.message;
  return unhealthy;
}
