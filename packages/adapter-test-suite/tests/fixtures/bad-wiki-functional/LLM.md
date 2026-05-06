# bad-wiki-functional fixture

A negative fixture: manifest correctly claims `category: "wiki"` (so the
wiki suite dispatches), but every method violates the contract.
list returns a non-array; read returns empty even for missing paths
(never throws); write/append are silent no-ops; search returns empty.

## Use

This package is private and intended only for adapter-test-suite tests.
Used to verify that each of the 6 wiki functional checks correctly
reports a failure when the contract is violated.
