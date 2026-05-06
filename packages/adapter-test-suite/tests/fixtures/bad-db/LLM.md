# bad-db (test fixture)

Conformance fixture used by adapter-test-suite tests. Intentionally exports
the wrong category on its module so the db suite bootstrap check fires.

## Behaviors

- Module exports `{ category: 'host', id: 'bad-db' }` — wrong category.
- The manifest correctly declares `category: "db"` so the db suite runs.
- The db/createInstance bootstrap check should catch the category mismatch.

## Fixture contract

This package exists only as a fixture inside the adapter-test-suite tests; do
not depend on it from real code.
