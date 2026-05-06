# good-db (test fixture)

Conformance fixture used by adapter-test-suite tests. Returns canned
DatabaseInstance / connection-string / state-bundle responses.

## Behaviors

- createInstance returns a DatabaseInstance with a stable dbId.
- destroyInstance throws AgentryError on empty ConfirmToken.
- connectionString returns "postgres://probe@localhost/probe".

## Fixture contract

This package exists only as a fixture inside the adapter-test-suite tests; do
not depend on it from real code.
