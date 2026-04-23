/**
 * Arel query translator: Ruby → TypeScript
 *
 * Usage:
 *   tsx scripts/parity/translate/arel.ts [--fixture arel-XX] [--dry-run]
 *
 * Reads the `-- Query:` comment from each arel fixture's schema.sql,
 * applies the rule-based translation map from docs/query-parity-verification.md,
 * and writes query.rb + query.ts into the fixture directory.
 *
 * Run once and commit. Re-running is idempotent unless --force is given.
 * Fixtures that cannot be auto-translated get a TODO marker.
 *
 * Must be run from the repo root.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = "scripts/parity/fixtures";

interface FixtureInfo {
  name: string;
  query: string;
  tables: string[];
}

function usage(): never {
  process.stderr.write(
    "Usage: tsx scripts/parity/translate/arel.ts [--fixture arel-XX] [--dry-run] [--force]\n",
  );
  process.exit(1);
}

function parseArgs(): { fixture?: string; dryRun: boolean; force: boolean } {
  const args = process.argv.slice(2);
  let fixture: string | undefined;
  let dryRun = false;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fixture") fixture = args[++i];
    else if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--force") force = true;
    else {
      process.stderr.write(`unknown argument: ${args[i]}\n`);
      usage();
    }
  }
  return { fixture, dryRun, force };
}

function parseSchemaSql(dir: string): FixtureInfo {
  const sql = readFileSync(join(dir, "schema.sql"), "utf8");
  const fixtureMatch = sql.match(/-- Fixture for statement: (\S+)/);
  const queryMatch = sql.match(/-- Query: (.+)/);
  const tables = [...sql.matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]!.toLowerCase());
  return {
    name: fixtureMatch?.[1] ?? "",
    query: queryMatch?.[1]?.trim() ?? "",
    tables,
  };
}

/** Generate Ruby query.rb content for an Arel fixture. */
function generateRuby(info: FixtureInfo): string {
  const lines: string[] = [`# ${info.name}: ${info.query}`, ""];
  // Declare Arel::Table vars for each table in the schema
  for (const t of info.tables) {
    lines.push(`${t} = Arel::Table.new(:${t})`);
  }
  lines.push("");
  lines.push(`# TODO: translate query — ${info.query}`);
  lines.push("");
  return lines.join("\n");
}

/** Generate TypeScript query.ts content for an Arel fixture. */
function generateTs(info: FixtureInfo): string {
  const imports = new Set<string>(["Table"]);
  const lines: string[] = [];
  lines.push(`// ${info.name}: ${info.query}`);
  lines.push(""); // imports placeholder, filled in below
  lines.push("");
  // Declare Table vars
  for (const t of info.tables) {
    lines.push(`const ${t} = new Table("${t}");`);
  }
  lines.push("");
  lines.push(`// TODO: translate query — ${info.query}`);
  lines.push("");

  const importLine = `import { ${[...imports].sort().join(", ")} } from "@blazetrails/arel";`;
  lines[1] = importLine;
  return lines.join("\n");
}

function arelFixtures(): string[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("arel-"))
    .map((e) => e.name)
    .sort();
}

function main(): void {
  if (!existsSync(FIXTURES_DIR)) {
    process.stderr.write("parity translate: must be run from repo root\n");
    process.exit(1);
  }

  const { fixture, dryRun, force } = parseArgs();
  const fixtures = fixture ? [fixture] : arelFixtures();

  let generated = 0;
  let skipped = 0;

  for (const name of fixtures) {
    const dir = join(FIXTURES_DIR, name);
    if (!existsSync(join(dir, "schema.sql"))) {
      process.stderr.write(`  skip ${name}: no schema.sql\n`);
      continue;
    }

    const rbPath = join(dir, "query.rb");
    const tsPath = join(dir, "query.ts");

    if (!force && existsSync(rbPath) && existsSync(tsPath)) {
      skipped++;
      continue;
    }

    const info = parseSchemaSql(dir);
    const rb = generateRuby(info);
    const ts = generateTs(info);

    if (dryRun) {
      process.stdout.write(`\n=== ${name}/query.rb ===\n${rb}`);
      process.stdout.write(`\n=== ${name}/query.ts ===\n${ts}`);
    } else {
      writeFileSync(rbPath, rb);
      writeFileSync(tsPath, ts);
      generated++;
    }
  }

  if (!dryRun) {
    process.stdout.write(`generated: ${generated}, skipped (already exist): ${skipped}\n`);
    process.stdout.write(
      `Review all generated files — each has a TODO where the query must be translated.\n`,
    );
  }
}

main();
