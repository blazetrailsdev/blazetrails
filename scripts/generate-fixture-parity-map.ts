#!/usr/bin/env npx tsx
/**
 * Generates eslint/test-fixture-parity.json — trails file → fixture-using
 * test descriptions. Class-level `fixtures :foo` marks ALL tests in the file.
 * Run: pnpm tsx scripts/generate-fixture-parity-map.ts  (commit the result).
 */
// fs/path bare per convention; sync fs acceptable in a one-shot CLI generator.
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const CASES_DIR = path.join(ROOT, "vendor/rails/activerecord/test/cases");
const OUT_FILE = path.join(ROOT, "eslint/test-fixture-parity.json");

const SYM_OR_STR = /(?::([a-zA-Z_][\w-]*)|["']([^"']+)["'])/g;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function railsToTrailsRel(railsRel: string): string {
  return railsRel.replace(/_test\.rb$/, ".test.ts").replace(/_/g, "-");
}

function parseFixtureNames(after: string): string[] {
  const names: string[] = [];
  for (const m of after.matchAll(SYM_OR_STR)) names.push(m[1] ?? m[2]);
  return names;
}

interface TestEntry {
  desc: string;
  body: string;
}

function extractTests(src: string): TestEntry[] {
  const lines = src.split("\n");
  const entries: TestEntry[] = [];

  const DEF_RE = /^(\s*)def\s+(test_[a-zA-Z0-9_?!]*)/;
  const BLK_RE = /^(\s*)test\s+["']([^"']+)["']\s+do\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dm = line.match(DEF_RE);
    if (dm) {
      const indent = dm[1].length;
      const rawDesc = dm[2].replace(/^test_/, "").replace(/_/g, " ");
      const end = findBodyEnd(lines, i, indent);
      entries.push({ desc: normalize(rawDesc), body: lines.slice(i + 1, end).join("\n") });
      continue;
    }
    const bm = line.match(BLK_RE);
    if (bm) {
      const indent = bm[1].length;
      const end = findBodyEnd(lines, i, indent);
      entries.push({ desc: normalize(bm[2]), body: lines.slice(i + 1, end).join("\n") });
    }
  }
  return entries;
}

function findBodyEnd(lines: string[], startIdx: number, indent: number): number {
  for (let j = startIdx + 1; j < lines.length; j++) {
    const l = lines[j];
    if (l.trim() === "") continue;
    const lead = l.match(/^(\s*)/)![1].length;
    if (lead === indent && /^\s*end\b/.test(l)) return j;
  }
  return lines.length;
}

function processFile(file: string): { trailsRel: string; descs: string[] } | null {
  const src = fs.readFileSync(file, "utf8");

  // Collect all class-level fixtures declarations (may appear multiple times)
  const fixtureNames: string[] = [];
  for (const m of src.matchAll(/^\s*fixtures\s+(.+)$/gm)) {
    fixtureNames.push(...parseFixtureNames(m[1]));
  }

  const tests = extractTests(src);
  if (tests.length === 0) return null;

  let useDescs: string[];
  if (fixtureNames.length > 0) {
    useDescs = tests.map((t) => t.desc);
  } else {
    useDescs = [];
  }

  if (useDescs.length === 0) return null;

  const relPath = path.relative(CASES_DIR, file).replace(/\\/g, "/");
  const trailsRel = railsToTrailsRel(relPath);
  return { trailsRel, descs: [...new Set(useDescs)].sort() };
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.isFile() && e.name.endsWith("_test.rb")) acc.push(full);
  }
  return acc;
}

function main() {
  if (!fs.existsSync(CASES_DIR)) {
    console.error(
      `[generate-fixture-parity-map] ${CASES_DIR} not found. Run pnpm vendor:fetch first.`,
    );
    process.exit(1);
  }

  const files = walk(CASES_DIR).sort();
  const out: Record<string, string[]> = {};

  for (const file of files) {
    const result = processFile(file);
    if (!result) continue;
    out[result.trailsRel] = result.descs;
  }

  const entries = Object.keys(out).length;
  const tests = Object.values(out).reduce((a, b) => a + b.length, 0);
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${OUT_FILE}: ${entries} files, ${tests} fixture-using tests`);
}

main();
