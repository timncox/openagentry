#!/usr/bin/env node
'use strict';

const args = process.argv.slice(2);

// codex argv: exec --model <m> <prompt>
let prompt = '';
let model = 'gpt-5';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') {
    model = args[i + 1] ?? model;
    i++;
    continue;
  }
  if (args[i] === 'exec') continue;
  prompt = args[i];
}

let system;
const SYSTEM_DELIMITER = '\n\n=== SYSTEM ===\n';
const sysIdx = prompt.indexOf(SYSTEM_DELIMITER);
if (sysIdx !== -1) {
  system = prompt.slice(0, sysIdx);
  prompt = prompt.slice(sysIdx + SYSTEM_DELIMITER.length);
}

if (prompt === 'error:nonzero') {
  process.stderr.write('simulated nonzero exit from stub-codex\n');
  process.exit(2);
}

if (prompt === 'Echo system.') {
  process.stdout.write((system ?? '') + '\n');
  process.exit(0);
}

if (prompt === 'Count to three.') {
  process.stdout.write('1\n2\n3\n');
  process.exit(0);
}

if (prompt === 'Say hi.') {
  process.stdout.write('hi from stub-codex\n');
  process.exit(0);
}

process.stdout.write('default-stub-response\n');
process.exit(0);
