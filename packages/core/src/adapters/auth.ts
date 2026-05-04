/**
 * AuthAdapter — manages user authentication for scaffolded apps.
 *
 * @module
 */

import type { IsoTimestamp } from '../types.js';

export interface AuthProvider {
  /** Provider id, e.g. "github", "google", "credentials". */
  id: string;
  label: string;
  enabled: boolean;
}

export interface AuthSession {
  userId: string;
  email?: string;
  name?: string;
  expiresAt: IsoTimestamp;
  meta?: Record<string, unknown>;
}

export interface AuthAdapter {
  readonly category: 'auth';
  readonly id: string;

  listProviders(): Promise<AuthProvider[]>;
  verifySession(token: string): Promise<AuthSession | null>;
}
