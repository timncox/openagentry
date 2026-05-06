# good-wiki-functional fixture

A fully-conforming `WikiAdapter` used to exercise the adapter-test-suite's
wiki functional checks. Stores pages in two in-memory `Map`s (workspace +
project) keyed by path. The path prefix (`workspace/` or `project/`)
determines scope.

## Use

This package is private and intended only for adapter-test-suite tests.

## Behavior

`list`, `read`, `write`, `append`, and `search` round-trip through the
in-memory store. `read` of a missing path throws an AgentryError-shaped
object to satisfy the structured-errors check.
