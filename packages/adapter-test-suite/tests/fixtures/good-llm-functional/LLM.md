# good-llm-functional fixture

A fully-conforming `LlmAdapter` used to exercise the adapter-test-suite's
llm functional checks. Returns deterministic responses for the known
conformance prompts (`Say hi.`, `Echo system.`, `Count to three.`,
`error:nonzero`).

## Use

This package is private and intended only for adapter-test-suite tests.

## Behavior

`listModels()` returns a single model. `generate` and `stream` switch on
the prompt to produce known outputs that exercise each functional check.
The `error:nonzero` prompt throws an AgentryError-shaped object to satisfy
the structured-errors check.
