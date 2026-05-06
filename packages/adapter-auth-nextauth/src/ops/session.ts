/**
 * verifySession — decodes a session token using either the JWT or database
 * strategy from next-auth, depending on `authOptions.session.strategy`.
 *
 * Contract: returns null for any invalid/expired token. Only throws
 * AgentryError for adapter-side misconfiguration (unknown strategy).
 *
 * @module
 */

import type { AuthSession, IsoTimestamp } from '@openagentry/core';
import type { NextAuthOptions, Session } from 'next-auth';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { decode } from 'next-auth/jwt';
import { NEXT_AUTH_ERROR_CODES, nextAuthError } from '../errors.js';

const SESSION_TOKEN_COOKIE = 'next-auth.session-token';
const SECURE_SESSION_TOKEN_COOKIE = '__Secure-next-auth.session-token';

type Strategy = 'jwt' | 'database';

function resolveStrategy(opts: NextAuthOptions): Strategy {
  const declared = opts.session?.strategy;
  if (declared === undefined) return 'jwt';
  if (declared === 'jwt' || declared === 'database') return declared;
  throw nextAuthError({
    code: NEXT_AUTH_ERROR_CODES.SCHEMA,
    message: `Unknown next-auth session.strategy "${declared}".`,
    phase: 'auth',
    suggestedFix:
      'Set authOptions.session.strategy to "jwt" or "database" (or omit for the next-auth default of "jwt").',
    context: { declared },
  });
}

async function verifyJwtSession(
  secret: string,
  token: string,
): Promise<AuthSession | null> {
  if (token.length === 0) return null;
  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode({ token, secret });
  } catch {
    return null;
  }
  if (decoded === null) return null;
  const sub = decoded.sub;
  if (typeof sub !== 'string' || sub.length === 0) return null;

  const expSec = decoded.exp;
  const expiresAt =
    typeof expSec === 'number'
      ? (new Date(expSec * 1000).toISOString() as IsoTimestamp)
      : (new Date(Date.now() + 3600_000).toISOString() as IsoTimestamp);

  const session: AuthSession = { userId: sub, expiresAt };
  if (typeof decoded.email === 'string') session.email = decoded.email;
  if (typeof decoded.name === 'string') session.name = decoded.name;
  return session;
}

async function verifyDatabaseSession(
  authOptions: NextAuthOptions,
  token: string,
): Promise<AuthSession | null> {
  if (token.length === 0) return null;

  // next-auth's getServerSession reads the session-token cookie. We
  // synthesize a minimal req/res pair. The cast goes through `unknown` to
  // satisfy TypeScript's strict overload resolution for getServerSession.
  const cookieValue = `${SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${SECURE_SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}`;
  const fakeReq = {
    headers: { cookie: cookieValue },
    cookies: {
      [SESSION_TOKEN_COOKIE]: token,
      [SECURE_SESSION_TOKEN_COOKIE]: token,
    },
  } as unknown as IncomingMessage & { cookies: Partial<Record<string, string>> };
  const fakeRes = {
    getHeader: () => undefined,
    setHeader: () => undefined,
    setCookie: () => undefined,
    end: () => undefined,
  } as unknown as ServerResponse<IncomingMessage>;

  // Lazy-import to keep the JWT path free of getServerSession's heavier deps.
  const { getServerSession } = await import('next-auth');
  let session: Session | null;
  try {
    session = await getServerSession(fakeReq, fakeRes, authOptions);
  } catch {
    return null;
  }
  if (session === null || session === undefined) return null;

  const userIdRaw = (session.user as { id?: unknown } | undefined)?.id;
  const emailRaw = session.user?.email;
  const userId =
    typeof userIdRaw === 'string'
      ? userIdRaw
      : typeof emailRaw === 'string'
      ? emailRaw
      : null;
  if (userId === null) return null;

  const expiresAt = (session.expires ?? new Date(Date.now() + 3600_000).toISOString()) as IsoTimestamp;
  const out: AuthSession = { userId, expiresAt };
  if (typeof emailRaw === 'string') out.email = emailRaw;
  const nameRaw = session.user?.name;
  if (typeof nameRaw === 'string') out.name = nameRaw;
  return out;
}

export async function verifySession(
  secret: string,
  authOptions: NextAuthOptions,
  token: string,
): Promise<AuthSession | null> {
  const strategy = resolveStrategy(authOptions);
  if (strategy === 'jwt') return verifyJwtSession(secret, token);
  return verifyDatabaseSession(authOptions, token);
}
