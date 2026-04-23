/**
 * Usage: tsx scripts/parity/schema/diff.ts --rails-dir <dir> --trails-dir <dir>
 *
 * Loads every *.json file present in both dirs, validates each against the
 * canonical JSON Schema, diffs rails vs trails per fixture, prints per-fixture
 * PASS/FAIL with unified diff on failure, and exits 1 if any fixture failed.
 *
 * D7: always runs all fixtures — never fail-fast.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import Ajv from "ajv/dist/2020.js";
import { createTwoFilesPatch } from "diff";

const SCHEMA_PATH = "scripts/parity/canonical/schema.schema.json";

function usage(): never {
  process.stderr.write(
    "Usage: tsx scripts/parity/schema/diff.ts --rails-dir <dir> --trails-dir <dir>\n",
  );
  process.exit(1);
}

function parseArgs(): { railsDir: string; trailsDir: string } {
  const args = process.argv.slice(2);
  let railsDir: string | undefined;
  let trailsDir: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--rails-dir") railsDir = args[++i];
    else if (args[i] === "--trails-dir") trailsDir = args[++i];
  }
  if (!railsDir || !trailsDir) usage();
  return { railsDir, trailsDir };
}

function sortedKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortedKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, sortedKeys((obj as Record<string, unknown>)[k])]),
    );
  }
  return obj;
}

function stableJson(obj: unknown): string {
  return JSON.stringify(sortedKeys(obj), null, 2) + "\n";
}

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

async function main(): Promise<void> {
  const { railsDir, trailsDir } = parseArgs();

  const schemaJson = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv();
  const validate = ajv.compile(schemaJson);

  const railsFiles = new Set(listJsonFiles(railsDir));
  const trailsFiles = new Set(listJsonFiles(trailsDir));
  const fixtures = [...railsFiles].filter((f) => trailsFiles.has(f)).sort();

  if (fixtures.length === 0) {
    process.stderr.write("parity diff: no matching fixture JSON files found in both dirs\n");
    process.exit(1);
  }

  const only_rails = [...railsFiles].filter((f) => !trailsFiles.has(f));
  const only_trails = [...trailsFiles].filter((f) => !railsFiles.has(f));
  if (only_rails.length > 0)
    process.stderr.write(`parity diff: only in rails: ${only_rails.join(", ")}\n`);
  if (only_trails.length > 0)
    process.stderr.write(`parity diff: only in trails: ${only_trails.join(", ")}\n`);

  let failures = 0;

  for (const file of fixtures) {
    const name = basename(file, ".json");
    const railsRaw = JSON.parse(readFileSync(join(railsDir, file), "utf8"));
    const trailsRaw = JSON.parse(readFileSync(join(trailsDir, file), "utf8"));

    // Validate both against canonical schema
    for (const [label, doc] of [
      ["rails", railsRaw],
      ["trails", trailsRaw],
    ] as const) {
      if (!validate(doc)) {
        process.stdout.write(`FAIL  ${name}  (${label} output fails schema validation)\n`);
        process.stdout.write(`      ${ajv.errorsText(validate.errors)}\n`);
        failures++;
        continue;
      }
    }

    // Stable JSON normalisation then line diff
    const railsNorm = stableJson(railsRaw);
    const trailsNorm = stableJson(trailsRaw);

    if (railsNorm === trailsNorm) {
      process.stdout.write(`PASS  ${name}\n`);
    } else {
      failures++;
      process.stdout.write(`FAIL  ${name}\n`);
      const patch = createTwoFilesPatch(
        `rails/${file}`,
        `trails/${file}`,
        railsNorm,
        trailsNorm,
        "",
        "",
        { context: 4 },
      );
      process.stdout.write(patch);
    }
  }

  process.stdout.write(`\n${fixtures.length - failures}/${fixtures.length} fixtures passed\n`);
  if (failures > 0) process.exit(1);
}

main().catch((err: unknown) => {
  process.stderr.write(`parity diff: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
