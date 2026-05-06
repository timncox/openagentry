#!/usr/bin/env node
'use strict';

// Stub `claude` CLI for conformance tests. Recognizes a small set of
// hardcoded prompts; emits stream-json output that matches the real
// Claude Code CLI format (assistant + result events).

const args = process.argv.slice(2);

// Find -p flag value (the prompt).
let prompt = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p') {
    prompt = args[i + 1] ?? '';
    break;
  }
}
// Find --append-system-prompt flag value.
let system;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--append-system-prompt') {
    system = args[i + 1];
    break;
  }
}
// Find --model flag value.
let model = 'claude-sonnet-4-6';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') {
    model = args[i + 1] ?? model;
    break;
  }
}

function emitText(text) {
  process.stdout.write(
    JSON.stringify({
      type: 'assistant',
      message: {
        model,
        content: [{ type: 'text', text }],
      },
    }) + '\n',
  );
}

function emitDone(inputTokens, outputTokens) {
  process.stdout.write(
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    }) + '\n',
  );
}

if (prompt === 'error:nonzero') {
  process.stderr.write('simulated nonzero exit from stub-claude\n');
  process.exit(2);
}

if (prompt === 'Echo system.') {
  emitText(system ?? '');
  emitDone(10, system ? system.length : 0);
  process.exit(0);
}

if (prompt === 'Count to three.') {
  emitText('1');
  emitText('2');
  emitText('3');
  emitDone(10, 3);
  process.exit(0);
}

if (prompt === 'Say hi.') {
  emitText('hi from stub-claude');
  emitDone(8, 5);
  process.exit(0);
}

emitText('default-stub-response');
emitDone(5, 5);
process.exit(0);
