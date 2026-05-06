# bad-auth (test fixture, wrong category)

This fixture intentionally exports a module whose default object has
`category: 'storage'`. The conformance suite should fail the
`auth/listProviders` bootstrap check before attempting any functional checks.

## Behaviors

- Exports an object with `category: 'storage'` to simulate a miscategorised adapter.
- Has no `listProviders` or `verifySession` methods.

## Fixture contract

This package exists only as a fixture inside the adapter-test-suite tests; do
not depend on it from real code.
