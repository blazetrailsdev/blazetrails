#!/usr/bin/env node
import { run } from "./cli.js";

// The `ar` bin entry — the only module that touches `process`, so `cli.ts`
// stays pure and unit-testable. This file is always the main module (never
// imported), so it runs unconditionally; no fragile import.meta/argv guard.
run(process.argv.slice(2), process.cwd()).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
