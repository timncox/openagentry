/**
 * deploy / rollback. Direct Upload flow.
 *
 * @module
 */

import {
  AgentryError,
  type Deployment,
  type DeployOpts,
  type HostProject,
  type IsoTimestamp,
} from '@openagentry/core';
import type { CloudflareApi } from '../client.js';
import { CF_ERROR_CODES } from '../errors.js';
import { sha256Hex } from '../internal/sha256.js';
import { walkDir, type WalkEntry } from '../internal/walk.js';
import type {
  CfPagesDeployment,
  CfPagesUploadToken,
  CfPagesUpsertResponse,
} from '../types.js';

const ADAPTER_ID = 'host-cloudflare';

interface ManifestEntry {
  hash: string;
  content: string;
  contentType: string;
  sizeInBytes: number;
}

const MIME_BY_EXT: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  webmanifest: 'application/manifest+json',
};

function contentTypeFor(relPath: string): string {
  const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function statusFromCfStage(s?: { status: string } | null): Deployment['status'] {
  switch (s?.status) {
    case 'idle':
      return 'queued';
    case 'active':
      return 'building';
    case 'success':
      return 'success';
    case 'failure':
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return 'queued';
  }
}

function envToCfBranch(env: 'preview' | 'prod'): { environment: 'preview' | 'production' } {
  return { environment: env === 'prod' ? 'production' : 'preview' };
}

function deploymentFromCf(cf: CfPagesDeployment): Deployment {
  return {
    id: cf.id,
    env: cf.environment === 'production' ? 'prod' : 'preview',
    url: cf.url,
    status: statusFromCfStage(cf.latest_stage ?? null),
    createdAt: cf.created_on as IsoTimestamp,
    meta: { short_id: cf.short_id },
  };
}

async function buildManifest(srcDir: string): Promise<{ manifest: Record<string, ManifestEntry>; entries: WalkEntry[] }> {
  const manifest: Record<string, ManifestEntry> = {};
  const entries: WalkEntry[] = [];
  for await (const entry of walkDir(srcDir)) {
    const hash = await sha256Hex(entry.bytes);
    manifest[entry.relPath] = {
      hash,
      content: toBase64(entry.bytes),
      contentType: contentTypeFor(entry.relPath),
      sizeInBytes: entry.bytes.length,
    };
    entries.push(entry);
  }
  return { manifest, entries };
}

export async function deploy(
  api: CloudflareApi,
  project: HostProject,
  env: 'preview' | 'prod',
  opts?: DeployOpts,
): Promise<Deployment> {
  const srcDir = (project as unknown as { meta?: { srcDir?: unknown } }).meta?.srcDir;
  if (typeof srcDir !== 'string' || srcDir.length === 0) {
    throw new AgentryError({
      code: CF_ERROR_CODES.HTTP,
      message: 'deploy requires a source directory; project.meta.srcDir is unset.',
      phase: 'deploy',
      adapter: ADAPTER_ID,
      suggestedFix:
        'Pass meta.srcDir into createProject (e.g., { meta: { srcDir: "./dist" } }) or set it on the HostProject before calling deploy.',
    });
  }

  // 1. Build manifest from local files.
  const { manifest } = await buildManifest(srcDir);

  // 2. Get an upload token.
  const token = await api.request<CfPagesUploadToken>(
    'POST',
    `/accounts/{account_id}/pages/projects/${project.slug}/upload-token`,
    { phase: 'deploy' },
  );

  // 3. Upsert assets. Body shape: { hash: { content, contentType, sizeInBytes } } keyed by hash.
  const upsertBody: Record<string, { content: string; contentType: string; sizeInBytes: number }> = {};
  for (const entry of Object.values(manifest)) {
    upsertBody[entry.hash] = {
      content: entry.content,
      contentType: entry.contentType,
      sizeInBytes: entry.sizeInBytes,
    };
  }
  const upsert = await api.request<CfPagesUpsertResponse>('POST', '/accounts/{account_id}/pages/assets/upsert', {
    phase: 'deploy',
    json: upsertBody,
    headers: { authorization: `Bearer ${token.jwt}` },
  });
  if (upsert.unsuccessful_keys.length > 0) {
    throw new AgentryError({
      code: CF_ERROR_CODES.PAGES_API,
      message: `Cloudflare rejected ${upsert.unsuccessful_keys.length} asset upload(s): ${upsert.unsuccessful_keys.slice(0, 5).join(', ')}`,
      phase: 'deploy',
      adapter: ADAPTER_ID,
      context: { unsuccessful_keys: upsert.unsuccessful_keys },
    });
  }

  // 4. Create the deployment with the manifest.
  const cfEnv = envToCfBranch(env);
  const deploymentManifest: Record<string, string> = {};
  for (const [path, entry] of Object.entries(manifest)) {
    deploymentManifest[`/${path}`] = entry.hash;
  }
  const deployBody: Record<string, unknown> = {
    branch: cfEnv.environment === 'production' ? 'main' : 'preview',
    manifest: deploymentManifest,
  };
  if (opts?.ref !== undefined) {
    deployBody['deployment_trigger'] = {
      type: 'ad_hoc',
      metadata: { commit_hash: opts.ref, environment: cfEnv.environment },
    };
  }
  const cfDep = await api.request<CfPagesDeployment>(
    'POST',
    `/accounts/{account_id}/pages/projects/${project.slug}/deployments`,
    { phase: 'deploy', json: deployBody },
  );

  return deploymentFromCf(cfDep);
}

export async function rollback(
  api: CloudflareApi,
  project: HostProject,
  deploymentId: string,
): Promise<Deployment> {
  const cf = await api.request<CfPagesDeployment>(
    'POST',
    `/accounts/{account_id}/pages/projects/${project.slug}/deployments/${deploymentId}/retry`,
    { phase: 'rollback' },
  );
  return deploymentFromCf(cf);
}
