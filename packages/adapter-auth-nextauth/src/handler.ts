/**
 * nextAuthHandler — convenience wrapper around `NextAuth(authOptions)` for
 * use as `app/api/auth/[...nextauth]/route.ts`. Pure pass-through; exposed
 * here so consumers don't need to import next-auth directly.
 *
 * @module
 */

import NextAuth, { type NextAuthOptions } from 'next-auth';

export function nextAuthHandler(authOptions: NextAuthOptions): ReturnType<typeof NextAuth> {
  return NextAuth(authOptions);
}
