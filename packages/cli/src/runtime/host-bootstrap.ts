/**
 * Host adapter bootstrap. Registers a `HostAdapter` in the global registry
 * based on env vars. Called once per CLI process before command dispatch.
 *
 * Preference order:
 *   1. OA_HOST="vercel" | "cloudflare" — explicit selection
 *   2. First provider whose required env is set (vercel before cloudflare)
 *   3. No registration (caller gets E_NO_ADAPTER_FOR_CATEGORY on useAdapter)
 *
 * Adapters are dynamically imported so a workspace without an adapter package
 * installed still runs non-host commands.
 *
 * @module
 */

import { registerAdapter } from '@openagentry/core';

type EnvMap = Readonly<Record<string, string | undefined>>;

let registered = false;

export function _resetForTesting(): void {
  registered = false;
}

function hasVercelEnv(env: EnvMap): boolean {
  return typeof env.OA_VERCEL_TOKEN === 'string' && env.OA_VERCEL_TOKEN.length > 0;
}

function hasCloudflareEnv(env: EnvMap): boolean {
  return (
    typeof env.OA_CLOUDFLARE_API_TOKEN === 'string' &&
    env.OA_CLOUDFLARE_API_TOKEN.length > 0 &&
    typeof env.OA_CLOUDFLARE_ACCOUNT_ID === 'string' &&
    env.OA_CLOUDFLARE_ACCOUNT_ID.length > 0
  );
}

function pickProvider(env: EnvMap): 'vercel' | 'cloudflare' | undefined {
  const explicit = env.OA_HOST;
  if (explicit === 'vercel' || explicit === 'cloudflare') return explicit;
  if (hasVercelEnv(env)) return 'vercel';
  if (hasCloudflareEnv(env)) return 'cloudflare';
  return undefined;
}

export async function ensureHostAdapter(env: EnvMap): Promise<void> {
  if (registered) return;
  const provider = pickProvider(env);
  if (provider === undefined) {
    // No env vars set — leave registry empty. Host commands will surface a
    // clear E_NO_ADAPTER_FOR_CATEGORY error when invoked.
    return;
  }

  if (provider === 'vercel') {
    const mod = await import('@openagentry/adapter-host-vercel');
    registerAdapter('host', mod.default);
    registered = true;
    return;
  }

  // provider === 'cloudflare'
  const mod = await import('@openagentry/adapter-host-cloudflare');
  registerAdapter('host', mod.default);
  registered = true;
}
