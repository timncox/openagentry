/**
 * Lifecycle hooks. init/refresh are no-ops at v0; auth + healthcheck both
 * validate secret + providers locally (no API call — auth verification is
 * purely local).
 *
 * Phase 'auth' IS in core's AgentryErrorPhase union — no cast workaround
 * needed.
 *
 * @module
 */

import type { NextAuthOptions } from 'next-auth';

export interface AuthResult {
  ok: boolean;
  message?: string;
}

export interface HealthcheckResult {
  status: 'healthy' | 'unhealthy';
  message?: string;
}

export async function init(
  _secret: string,
  _authOptions: NextAuthOptions,
): Promise<void> {
  // No local state to initialize at v0.
}

export async function refresh(
  _secret: string,
  _authOptions: NextAuthOptions,
): Promise<void> {
  // No local state to refresh at v0.
}

export async function auth(
  secret: string,
  authOptions: NextAuthOptions,
): Promise<AuthResult> {
  if (typeof secret !== 'string' || secret.length === 0) {
    return { ok: false, message: 'secret is empty — set NEXTAUTH_SECRET or pass secret in code.' };
  }
  const providers = authOptions.providers;
  if (!Array.isArray(providers) || providers.length === 0) {
    return {
      ok: false,
      message: 'authOptions.providers is empty — at least one next-auth provider is required.',
    };
  }
  return { ok: true };
}

export async function healthcheck(
  secret: string,
  authOptions: NextAuthOptions,
): Promise<HealthcheckResult> {
  const result = await auth(secret, authOptions);
  if (result.ok) return { status: 'healthy' };
  const unhealthy: HealthcheckResult = { status: 'unhealthy' };
  if (result.message !== undefined) unhealthy.message = result.message;
  return unhealthy;
}
