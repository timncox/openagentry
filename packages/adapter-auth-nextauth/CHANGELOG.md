# Changelog

## 0.1.0-alpha.0 (unreleased)

Initial release. First concrete `AuthAdapter` for OpenAgentry, backed by next-auth v4.

- Both `AuthAdapter` methods: `listProviders`, `verifySession`
- Lifecycle hooks: `init`, `auth`, `healthcheck`, `refresh`
- Supports both next-auth session strategies: JWT (`decode` from `next-auth/jwt`) and database (`getServerSession`)
- Stable error codes: `E_NEXTAUTH_AUTH`, `E_NEXTAUTH_NOT_FOUND`, `E_NEXTAUTH_SCHEMA`, `E_NEXTAUTH_NETWORK`, `E_NEXTAUTH_API`
- `nextAuthHandler(authOptions)` convenience wrapper for `app/api/auth/[...nextauth]/route.ts`
- Passes `@openagentry/adapter-test-suite auth` (universal + 5 functional checks)
- Phase string `'auth'` already exists in core's `AgentryErrorPhase` union — no cast workarounds required
