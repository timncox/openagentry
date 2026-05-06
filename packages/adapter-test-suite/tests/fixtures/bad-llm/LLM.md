# bad-llm fixture

A negative fixture: manifest claims `category: "host"` but the default
export has `category: "llm"`. Used to verify the host suite emits a
bootstrap fail when the default export's category disagrees with the
expected category.

## Use

This package is private and intended only for adapter-test-suite tests.
