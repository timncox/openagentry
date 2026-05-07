# bad-domain — test fixture

This is a deliberately non-conformant domain adapter used by the OpenAgentry
conformance suite's own tests to verify that `domain/structured-errors` correctly
identifies adapters that throw plain `Error` instead of `AgentryError`. Do not
use this fixture in production.

## Behaviour

All methods throw a plain `Error`; none return useful results. The fixture is
intentionally non-conformant: `checkAvailability` throws `Error` instead of
`AgentryError`, which fails the `domain/structured-errors` check.

## Purpose

Used by `tests/suites/domain.test.ts` to assert that the domain suite correctly
reports `domain/structured-errors` as a failure when the adapter does not use
structured errors. The `LLM.md` file is present so the universal `docs/llm-md`
check passes, isolating the failure to the structured-errors check only.
