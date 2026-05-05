# bad-db-functional (test fixture)

A db-category adapter whose method implementations intentionally violate
db functional conformance. Used to assert the dbSuite reports failures
correctly.

## Behaviors

- createInstance returns a different dbId on each call (violates idempotency).
- destroyInstance with empty ConfirmToken resolves (violates structured-errors).
- connectionString returns http:// (violates URI scheme requirement).
- importState returns a mutated dbId (violates round-trip).

## Fixture contract

This package exists only as a fixture inside the adapter-test-suite tests; do
not depend on it from real code.
