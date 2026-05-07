# bad-repo — test fixture

This is a deliberately non-conformant repo adapter used by the OpenAgentry
conformance suite's own tests to verify that `repo/structured-errors` correctly
identifies adapters that throw plain `Error` instead of `AgentryError`. Do not
use this fixture in production.

## Behaviour

All four methods (`create`, `delete`, `get`, `remoteUrl`) throw a plain `Error`;
none return useful results. The fixture is intentionally non-conformant: `get`
throws `Error` instead of returning `null` or throwing `AgentryError`, which
fails the `repo/structured-errors` check.

## Purpose

Used by `tests/suites/repo.test.ts` to assert that the repo suite correctly
reports `repo/structured-errors` as a failure when the adapter does not use
structured errors. The `LLM.md` file is present so the universal `docs/llm-md`
check passes, isolating the failure to the structured-errors check only.
