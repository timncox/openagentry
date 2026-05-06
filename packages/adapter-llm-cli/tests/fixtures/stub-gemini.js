#!/usr/bin/env node
'use strict';

const args = process.argv.slice(2);

let prompt = '';
let system;
let model = 'gemini-2.5-pro';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') {
    model = args[i + 1] ?? model;
    i++;
    continue;
  }
  if (args[i] === '--system-instruction') {
    system = args[i + 1];
    i++;
    continue;
  }
  if (args[i] === '-p') {
    prompt = args[i + 1] ?? '';
    i++;
    continue;
  }
}

if (prompt === 'error:nonzero') {
  process.stderr.write('simulated nonzero exit from stub-gemini\n');
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
  process.stdout.write('hi from stub-gemini\n');
  process.exit(0);
}

process.stdout.write('default-stub-response\n');
process.exit(0);
