# good-auth (test fixture)

Conformance fixture used by adapter-test-suite tests. Decodes JWTs using the
shared conformance test secret and returns synthesized AuthSession objects.

## Behaviors

- listProviders returns one stable credentials provider.
- verifySession decodes the JWT with the test secret and returns
  AuthSession on success, null on failure (invalid signature, expired).

## Fixture contract

This package exists only as a fixture inside the adapter-test-suite tests; do
not depend on it from real code.
