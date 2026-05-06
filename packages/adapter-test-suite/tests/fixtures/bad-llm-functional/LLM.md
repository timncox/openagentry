# bad-llm-functional fixture

A negative fixture: manifest correctly claims `category: "llm"` (so the
llm suite dispatches), but every method violates the contract.
listModels returns empty; generate returns empty text; system opt is
ignored; stream never emits done; error path throws plain Error instead
of AgentryError.

## Use

This package is private and intended only for adapter-test-suite tests.
Used to verify that each of the 5 llm functional checks correctly reports
a failure when the contract is violated.
