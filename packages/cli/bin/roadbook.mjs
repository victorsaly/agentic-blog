#!/usr/bin/env node
// Why: roadbook.config.ts is TypeScript, so the command runs under tsx, which loads it without a build
// step. This file only hands the arguments over; everything else is in src/main.ts.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const tsx = require.resolve('tsx/cli');
const main = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const { status } = spawnSync(process.execPath, [tsx, main, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(status ?? 1);
