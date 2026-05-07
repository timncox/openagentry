/**
 * Thin wrapper around aws4fetch for SigV4-signed S3 requests against R2's
 * S3-compatible endpoint. Single chokepoint for signing + dispatch.
 *
 * @module
 */

import { AwsClient } from 'aws4fetch';
import type { R2StorageConfig } from './config.js';

export interface S3RequestOpts {
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  /** Object key. Omit for bucket-level operations like list. */
  key?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export interface SignedFetch {
  request(opts: S3RequestOpts): Promise<Response>;
  presignGet(key: string, ttlSeconds: number): Promise<string>;
  endpoint: string;
  bucket: string;
}

function encodeKey(key: string): string {
  // Encode each path segment but preserve `/` as the path separator.
  return key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function buildUrl(
  endpoint: string,
  bucket: string,
  key: string | undefined,
  query?: Record<string, string>,
): string {
  const base = new URL(
    `${endpoint.replace(/\/$/, '')}/${bucket}${key !== undefined ? '/' + encodeKey(key) : ''}`,
  );
  if (query !== undefined) {
    for (const [k, v] of Object.entries(query)) {
      base.searchParams.set(k, v);
    }
  }
  return base.toString();
}

export function createS3Client(config: R2StorageConfig): SignedFetch {
  // R2StorageConfig guarantees endpoint and region are non-optional strings;
  // cast through string to satisfy exactOptionalPropertyTypes when forwarding
  // to aws4fetch whose constructor types these as optional.
  const endpoint = config.endpoint as string;
  const region = config.region as string;
  const bucket = config.bucket;

  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    ...(region !== undefined && { region }),
  });

  async function request(opts: S3RequestOpts): Promise<Response> {
    const url = buildUrl(endpoint, bucket, opts.key, opts.query);
    const init: RequestInit = { method: opts.method };
    if (opts.body !== undefined) init.body = opts.body;
    if (opts.headers !== undefined) init.headers = opts.headers;
    return aws.fetch(url, init);
  }

  async function presignGet(key: string, ttlSeconds: number): Promise<string> {
    // aws4fetch reads X-Amz-Expires from URL search params when signQuery=true.
    // If absent it defaults to 86400 — so we must set it before signing.
    const base = new URL(buildUrl(endpoint, bucket, key));
    base.searchParams.set('X-Amz-Expires', String(ttlSeconds));
    const signed = await aws.sign(base.toString(), {
      method: 'GET',
      aws: { signQuery: true },
    });
    return signed.url;
  }

  return {
    request,
    presignGet,
    endpoint,
    bucket,
  };
}
