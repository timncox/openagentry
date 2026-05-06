# bad-auth-functional (test fixture)

Adapter whose manifest correctly declares `category: 'auth'` so the suite
dispatches the auth functional suite, but whose methods misbehave —
listProviders returns empty, verifySession returns a fake session for every
input. Used by tests/suites/auth.test.ts to verify the suite catches each
failure mode.

## Behaviors

- listProviders returns an empty array — fails the non-empty assertion.
- verifySession returns a fake session for every input — fails rejects-invalid,
  rejects-expired, structured-errors, and roundtrip (wrong userId).

## Fixture contract

Test fixture only — never depend on it from real code.
