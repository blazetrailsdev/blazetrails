#!/usr/bin/env node
/**
 * `trails-tsc` CLI entrypoint. Phase 2c-a ships the `build` subcommand
 * only; `dev` (watch) is 2c-b and `init` is 2c-c.
 */

import { pathToFileURL } from "node:url";
import { buildViews, type BuildViewsOptions } from "./build-views.js";

const USAGE = "usage: trails-tsc build [--cwd <dir>] [--views <dir>] [--out <dir>]\n";

export function runCli(argv: readonly string[]): number {
  const cmd = argv[0];
  if (cmd === undefined || cmd === "--help" || cmd === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (cmd !== "build") {
    process.stderr.write(`trails-tsc: unknown command ${JSON.stringify(cmd)}\n${USAGE}`);
    return 1;
  }
  const opts: BuildViewsOptions = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    const v = argv[i + 1];
    if ((a === "--cwd" || a === "--views" || a === "--out") && v !== undefined) {
      if (a === "--cwd") opts.cwd = v;
      else if (a === "--views") opts.viewsDir = v;
      else opts.outDir = v;
      i++;
      continue;
    }
    process.stderr.write(`trails-tsc: unknown arg ${JSON.stringify(a)}\n${USAGE}`);
    return 1;
  }
  const { count } = buildViews(opts);
  process.stdout.write(`trails-tsc: built ${count} view${count === 1 ? "" : "s"}\n`);
  return 0;
}

// Skip auto-exec when imported (e.g. from tests). `import.meta.url` is the
// invoked module only when run as the program entrypoint.
// Compare module URL to argv[1] via `pathToFileURL` so Windows paths and
// URL-encoded chars don't trip a naive `file://` string compare.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exit(runCli(process.argv.slice(2)));
}
