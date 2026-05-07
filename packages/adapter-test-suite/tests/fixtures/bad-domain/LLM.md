# bad-domain — test fixture

This is a deliberately non-conformant domain adapter used by the OpenAgentry
conformance suite's own tests to verify that `domain/structured-errors` correctly
identifies adapters that throw plain `Error` instead of `AgentryError`. Do not
use this fixture in production. All methods throw a plain `Error`; none return
useful results.
