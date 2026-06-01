#!/usr/bin/env -S npx tsx
/**
 * Generates eslint/test-fixture-parity.json — trails file → fixture-using
 * test descriptions.
 *
 * `fixtures :foo` is a **class-level** declaration in Rails: it only loads
 * fixtures for tests in that class (and its subclasses). Detection is therefore
 * scoped per declaring class, never per file — otherwise a `fixtures` line in
 * one nested class leaks onto every test in the file (see
 * `tasks/database_tasks_test.rb`, where `fixtures :courses, :colleges` lives in
 * a single nested class but no test calls a `courses(`/`colleges(` accessor).
 *
 * Only tests whose declaring class has fixtures in scope (own + inherited from
 * an in-file superclass) are candidates. Among those candidates, detection
 * signals (union) — the same precise-vs-fallback granularity as before, just
 * restricted to the fixture-scoped set so leakage can't pull in tests from
 * sibling classes that declare no fixtures:
 *   1. per-test body accessor `foo(:record)` → marks that specific candidate
 *      (precise: skips candidates that don't touch fixtures).
 *   2. NO candidate body-access detected anywhere → marks every candidate
 *      (Rails still loads fixtures; they may be used indirectly via
 *      associations or model state).
 *
 * Run: pnpm tsx scripts/generate-fixture-parity-map.ts  (commit the result).
 */
// fs/path bare per convention; sync fs acceptable in a one-shot CLI generator.
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  for (const m of after.matchAll(SYM_OR_STR)) {
    const name = m[1] ?? m[2];
    if (name) names.push(name);
  }
  return names;
}

interface TestEntry {
  desc: string;
  bodyLines: string[];
  /** Line index of the `def`/`test ... do` header — used to find the owning class. */
  lineIdx: number;
}

function extractTests(lines: string[]): TestEntry[] {
  const entries: TestEntry[] = [];

  const DEF_RE = /^(\s*)def\s+(test_[a-zA-Z0-9_?!]*)/;
  const BLK_RE = /^(\s*)test\s+["']([^"']+)["']\s+do\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dm = line.match(DEF_RE);
    if (dm) {
      const end = findBodyEnd(lines, i, dm[1].length);
      entries.push({
        desc: normalize(dm[2].replace(/^test_/, "").replace(/_/g, " ")),
        bodyLines: lines.slice(i + 1, end),
        lineIdx: i,
      });
      continue;
    }
    const bm = line.match(BLK_RE);
    if (bm) {
      const end = findBodyEnd(lines, i, bm[1].length);
      entries.push({ desc: normalize(bm[2]), bodyLines: lines.slice(i + 1, end), lineIdx: i });
    }
  }
  return entries;
}

interface ClassInfo {
  name: string;
  superName: string | null;
  start: number;
  end: number;
}

/**
 * Extract Ruby class declarations with their `[start, end]` line ranges
 * (the closing `end` matched by indentation). Handles arbitrary nesting:
 * a class inside a module/class is its own range.
 */
function extractClasses(lines: string[]): ClassInfo[] {
  const CLASS_RE = /^(\s*)class\s+([A-Za-z0-9_:]+)\s*(?:<\s*([A-Za-z0-9_:]+))?/;
  const out: ClassInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(CLASS_RE);
    if (!m) continue;
    out.push({
      name: m[2],
      superName: m[3] ?? null,
      start: i,
      end: findBodyEnd(lines, i, m[1].length),
    });
  }
  return out;
}

/** Strip a Ruby namespace qualifier (`ActiveRecord::Foo` → `Foo`). */
function baseName(name: string): string {
  const idx = name.lastIndexOf("::");
  return idx === -1 ? name : name.slice(idx + 2);
}

/** Innermost class whose body strictly contains `lineIdx`, or null. */
function ownerClass(classes: ClassInfo[], lineIdx: number): ClassInfo | null {
  let best: ClassInfo | null = null;
  for (const c of classes) {
    if (c.start < lineIdx && lineIdx < c.end && (!best || c.start > best.start)) best = c;
  }
  return best;
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

/**
 * Build a regex that matches bare `fixtureSetName(:` accessor calls.
 * Uses word-boundary so `categories(` doesn't match inside `categories_posts(`.
 */
function buildAccessorRe(fixtureNames: string[]): RegExp | null {
  const escaped = fixtureNames
    .filter((n) => /^[a-zA-Z_]/.test(n))
    .map((n) => n.replace(/[-]/g, "\\-"));
  if (escaped.length === 0) return null;
  return new RegExp(`\\b(${escaped.join("|")})\\s*\\(`);
}

interface FixtureDecl {
  names: string[];
  lineIdx: number;
}

function collectFixtureDecls(lines: string[]): FixtureDecl[] {
  // Multi-line-aware: trailing comma means the list continues on the next line.
  const decls: FixtureDecl[] = [];
  const START_RE = /^\s*fixtures\s+(.+)$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(START_RE);
    if (!m) continue;
    const lineIdx = i;
    let buf = m[1];
    while (buf.trimEnd().endsWith(",") && i + 1 < lines.length) {
      buf += " " + lines[++i].trim();
    }
    decls.push({ names: parseFixtureNames(buf), lineIdx });
  }
  return decls;
}

/**
 * Pure core: given a Rails test-file source string, return the sorted set of
 * normalized test descriptions whose Rails counterpart loads fixtures (scoped
 * per declaring class, never per file). Exported for unit testing.
 */
export function mapSource(src: string): string[] {
  const lines = src.split("\n");

  const decls = collectFixtureDecls(lines);
  if (decls.length === 0) return [];

  const tests = extractTests(lines);
  if (tests.length === 0) return [];

  const classes = extractClasses(lines);
  const byName = new Map<string, ClassInfo>(classes.map((c) => [c.name, c]));

  // Fixtures declared directly inside each class (keyed by ClassInfo identity).
  const ownFixtures = new Map<ClassInfo, string[]>();
  for (const d of decls) {
    const owner = ownerClass(classes, d.lineIdx);
    if (!owner) continue; // fixtures outside any class — not Rails-valid; ignore.
    const list = ownFixtures.get(owner) ?? [];
    list.push(...d.names);
    ownFixtures.set(owner, list);
  }

  // A class inherits fixtures from an in-file superclass (Rails subclasses
  // inherit `fixtures` declarations).
  function effectiveFixtures(c: ClassInfo, seen = new Set<ClassInfo>()): string[] {
    if (seen.has(c)) return [];
    seen.add(c);
    const own = ownFixtures.get(c) ?? [];
    const sup = c.superName ? byName.get(baseName(c.superName)) : undefined;
    return sup ? [...own, ...effectiveFixtures(sup, seen)] : own;
  }

  // Candidates: tests whose declaring class has fixtures in scope. This alone
  // fixes the cross-class leak — tests in sibling classes that declare no
  // fixtures are never marked. Each candidate carries its own class's fixture
  // names so the accessor check matches the right set.
  const candidates: { test: TestEntry; accessorRe: RegExp | null }[] = [];
  for (const t of tests) {
    const owner = ownerClass(classes, t.lineIdx);
    if (!owner) continue;
    const fixtureNames = effectiveFixtures(owner);
    if (fixtureNames.length === 0) continue;
    candidates.push({ test: t, accessorRe: buildAccessorRe(fixtureNames) });
  }
  if (candidates.length === 0) return [];

  // Precise-vs-fallback among candidates only (preserves the prior file-wide
  // granularity): if any candidate references its fixtures, mark just those;
  // otherwise mark every candidate.
  const withAccess = candidates.filter(
    (c) => c.accessorRe && c.accessorRe.test(c.test.bodyLines.join("\n")),
  );
  const marked = withAccess.length > 0 ? withAccess : candidates;
  const useDescs = marked.map((c) => c.test.desc);

  return [...new Set(useDescs)].sort();
}

function processFile(file: string): { trailsRel: string; descs: string[] } | null {
  const descs = mapSource(fs.readFileSync(file, "utf8"));
  if (descs.length === 0) return null;

  const relPath = path.relative(CASES_DIR, file).replace(/\\/g, "/");
  const trailsRel = railsToTrailsRel(relPath);
  return { trailsRel, descs };
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

if (import.meta.url === `file://${process.argv[1]}`) main();
