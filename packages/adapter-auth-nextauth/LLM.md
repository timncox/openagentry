# @openagentry/adapter-auth-nextauth (LLM context)

OpenAgentry `AuthAdapter` implementation backed by **next-auth v4**.

## Public API

- `createNextAuthAuthAdapter({ secret, authOptions })` — returns a fully-typed
  `AuthAdapter`. `secret` is the next-auth secret string. `authOptions` is a
  full `NextAuthOptions` object — at minimum a non-empty `providers` array.
- `default export` — same adapter, constructed from `process.env.NEXTAUTH_SECRET`
  plus a built-in minimal credentials provider so the conformance suite runs
  ungated. Falls back to a built-in test secret when `NEXTAUTH_SECRET` is unset.
  Real users override authOptions by calling `createNextAuthAuthAdapter()`
  directly — never rely on the default in production code.
- `nextAuthHandler(authOptions)` — convenience wrapper around `NextAuth(authOptions)`
  for use as `app/api/auth/[...nextauth]/route.ts`.

## Behaviors and constraints

- **`listProviders()`** maps each entry in `authOptions.providers` to
  `{id, label, enabled: true}`. v0 always reports `enabled: true` since
  next-auth has no built-in disabled flag. Throws `E_NEXTAUTH_SCHEMA` if a
  provider lacks a string `id`.
- **`verifySession(token)`** inspects `authOptions.session?.strategy`:
  - **`'jwt'` (default)**: decodes via `next-auth/jwt`'s `decode({ token, secret })`.
    Returns `AuthSession` with `userId` from `sub`, optional `email`/`name`,
    `expiresAt` from `exp`. Returns `null` for any invalid signature, expired
    JWT, missing `sub`, or empty token.
  - **`'database'`**: synthesizes a request with the session-token cookie,
    calls `getServerSession(req, res, authOptions)`. Returns `null` on missing
    session. Requires a next-auth database adapter (drizzle/prisma/etc.) wired
    into `authOptions.adapter`.
  - **Unknown strategy**: throws `AgentryError(E_NEXTAUTH_SCHEMA)` with a
    `suggestedFix` listing valid strategies.
- **Returns `null` for invalid/expired tokens** — never throws on bad input.
  Adapter-side throws are reserved for misconfiguration (unknown strategy).
- **All adapter-side failures throw `AgentryError`** with stable codes:
  `E_NEXTAUTH_AUTH`, `E_NEXTAUTH_NOT_FOUND`, `E_NEXTAUTH_SCHEMA`,
  `E_NEXTAUTH_NETWORK`, `E_NEXTAUTH_API`. Each has a `phase: 'auth'` and an
  optional `suggestedFix`.

## Common pitfalls

- Calling `createNextAuthAuthAdapter({ secret: '', ... })` → zod throws
  immediately with a SchemaError citing `secret`.
- Setting `authOptions.session.strategy: 'cookies'` (or any value other than
  `'jwt'`/`'database'`) → `E_NEXTAUTH_SCHEMA` immediately on `verifySession`.
- Database strategy without a wired `authOptions.adapter` → next-auth itself
  errors at runtime; we surface that as `E_NEXTAUTH_NETWORK`.
- Using the package default in production → it constructs a stub credentials
  provider that always returns `null` from `authorize()`. Safe for testing,
  not useful for real auth.

## Conformance

```bash
pnpm --filter @openagentry/adapter-auth-nextauth test:integration
```

The integration test runs `runSuite()` against the package directory. Because
auth verification is local (no real cloud calls), it runs in normal CI without
env-var gating. Passes 4 universal + 5 auth functional checks = 9 total.
