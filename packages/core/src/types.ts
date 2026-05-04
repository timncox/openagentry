/**
 * Common types shared across all adapter categories and the runtime.
 *
 * @module
 */

/** Deployment / runtime environment. */
export type Env = 'preview' | 'prod' | 'dev';

declare const __confirm: unique symbol;
/**
 * Token required by destructive operations. Caller must explicitly construct
 * one to opt into the destruction. Prevents accidental data loss.
 */
export type ConfirmToken = string & { readonly [__confirm]: true };

declare const __iso: unique symbol;
/** ISO-8601 timestamp string, e.g. `"2026-05-04T12:34:56Z"`. */
export type IsoTimestamp = string & { readonly [__iso]: true };

declare const __region: unique symbol;
/** Provider-specific region identifier, e.g. `"us-east-1"`, `"global"`. */
export type Region = string & { readonly [__region]: true };

/** Identifies an adapter installation. */
export interface AdapterId {
  category: string;
  id: string;
  version: string;
}

/** A project tracked in a workspace. */
export interface Project {
  id: string;
  name: string;
  slug: string;
  createdAt: IsoTimestamp;
}

/** A deployment record returned by host adapters. */
export interface Deployment {
  id: string;
  env: Env;
  url: string;
  status: 'queued' | 'building' | 'success' | 'failed' | 'canceled';
  createdAt: IsoTimestamp;
  meta?: Record<string, unknown>;
}

/** A log line streamed by host adapters. */
export interface LogLine {
  timestamp: IsoTimestamp;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, unknown>;
}
