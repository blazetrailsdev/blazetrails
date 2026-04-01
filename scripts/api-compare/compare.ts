#!/usr/bin/env npx tsx
/**
 * Method-centric API comparison.
 *
 * Compares Ruby Rails API surface with our TypeScript API by matching
 * individual methods, not class/module wrappers. The file IS the module —
 * if Ruby's `Sanitization` module defines `sanitize_sql`, we look for
 * `sanitizeSql` anywhere in the expected TS file, regardless of whether
 * there's a `Sanitization` class/interface wrapping it.
 *
 * This prevents agents from gaming the metric with empty interfaces.
 *
 * Usage:
 *   npx tsx scripts/api-compare/compare.ts [--package activerecord] [--missing] [--files]
 */

import * as fs from "fs";
import * as path from "path";
import type { ApiManifest, ClassInfo, MethodInfo } from "./types.js";

const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = path.join(SCRIPT_DIR, "output");

const DETAIL_PACKAGES = new Set([
  "arel",
  "activemodel",
  "activerecord",
  "activesupport",
  "actiondispatch",
  "actioncontroller",
  "actionview",
]);

// ---------------------------------------------------------------------------
// Conventions
// ---------------------------------------------------------------------------

function snakeToCamel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

/** Ruby file path → expected TS file path (kebab-case, .ts extension) */
function rubyFileToTs(rubyFile: string): string {
  const dir = path.dirname(rubyFile);
  const base = path.basename(rubyFile, ".rb");
  const kebab = base.replace(/_/g, "-");
  const tsFile = kebab.replace(/\berb\b/g, "ejs") + ".ts";
  if (dir === ".") return tsFile;
  const tsDir = dir
    .split("/")
    .map((d) => d.replace(/_/g, "-").replace(/\berb\b/g, "ejs"))
    .join("/");
  return path.join(tsDir, tsFile);
}

const OPERATORS = new Set([
  "[]",
  "[]=",
  "==",
  "===",
  "!=",
  "<=>",
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "~",
  "!",
  "!~",
  "=~",
  ">>",
  "<<",
  "~@",
]);

const SKIP = new Set([
  "dup",
  "clone",
  "freeze",
  "hash",
  "inspect",
  "pretty_print",
  "object_id",
  "class",
  "send",
  "public_send",
  "tap",
  "then",
  "yield_self",
  "respond_to?",
  "respond_to_missing?",
  "method_missing",
  "is_a?",
  "kind_of?",
  "instance_of?",
  "nil?",
  "equal?",
  "eql?",
  "instance_variable_get",
  "instance_variable_set",
  "instance_variables",
  "initialize_copy",
  "initialize_dup",
  "initialize_clone",
  "encode_with",
  "init_with",
  "to_ary",
  "to_a",
  "to_i",
  "to_f",
  "to_h",
  "to_hash",
  "to_r",
  "to_c",
]);

/** Convert Ruby method name → expected TS name (null = skip) */
function rubyMethodToTs(name: string): string | null {
  if (OPERATORS.has(name)) return null;
  if (SKIP.has(name)) return null;
  if (name.startsWith("_")) return null;

  if (name === "initialize") return "constructor";
  if (name === "to_s" || name === "to_str") return "toString";
  if (name === "to_json") return "toJSON";
  if (name === "to_sql") return "toSql";

  if (name.endsWith("?")) {
    const base = name.slice(0, -1);
    return "is" + snakeToCamel(base).replace(/^./, (c) => c.toUpperCase());
  }

  if (name.endsWith("!")) {
    const base = name.slice(0, -1);
    return snakeToCamel(base) + "Bang";
  }

  if (name.endsWith("=")) {
    const base = name.slice(0, -1);
    return snakeToCamel(base);
  }

  return snakeToCamel(name);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MethodResult {
  rubyName: string;
  tsName: string;
  rubyModule: string;
}

interface FileResult {
  rubyFile: string;
  expectedTsFile: string;
  tsFileExists: boolean;
  matched: number;
  missing: number;
  total: number;
  missingMethods: MethodResult[];
}

interface PackageResult {
  package: string;
  totalMethods: number;
  matched: number;
  missing: number;
  percent: number;
  files: FileResult[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const pkgIndex = args.indexOf("--package");
  let filterPkg: string | null = null;
  if (pkgIndex !== -1) {
    const value = args[pkgIndex + 1];
    if (!value || value.startsWith("--")) {
      console.error("--package requires a package name (e.g. --package activerecord)");
      process.exit(1);
    }
    filterPkg = value;
  }
  const showMissing = args.includes("--missing");
  const showFiles = args.includes("--files");

  const rubyPath = path.join(OUTPUT_DIR, "rails-api.json");
  const tsPath = path.join(OUTPUT_DIR, "ts-api.json");

  if (!fs.existsSync(rubyPath)) {
    console.error("Missing rails-api.json — run extract-ruby-api.rb first");
    process.exit(1);
  }
  if (!fs.existsSync(tsPath)) {
    console.error("Missing ts-api.json — run extract-ts-api.ts first");
    process.exit(1);
  }

  const ruby: ApiManifest = JSON.parse(fs.readFileSync(rubyPath, "utf-8"));
  const ts: ApiManifest = JSON.parse(fs.readFileSync(tsPath, "utf-8"));

  const results: PackageResult[] = [];

  for (const [pkg, rubyPkg] of Object.entries(ruby.packages)) {
    if (filterPkg && pkg !== filterPkg) continue;

    const tsPkg = ts.packages[pkg];

    // Build per-file method index from TS: file → Set<methodName>
    const tsMethodsByFile = new Map<string, Set<string>>();

    if (tsPkg) {
      const addMethods = (cls: ClassInfo) => {
        const file = cls.file || "";
        const methods = tsMethodsByFile.get(file) || new Set();
        for (const m of [...cls.instanceMethods, ...cls.classMethods]) {
          methods.add(m.name);
        }
        tsMethodsByFile.set(file, methods);
      };

      for (const cls of Object.values(tsPkg.classes)) addMethods(cls);
      for (const mod of Object.values(tsPkg.modules)) addMethods(mod);

      // Include file-level functions (top-level exports not in any class/interface)
      if (tsPkg.fileFunctions) {
        for (const [file, fns] of Object.entries(tsPkg.fileFunctions)) {
          const methods = tsMethodsByFile.get(file) || new Set();
          for (const fn of fns) {
            methods.add(fn.name);
          }
          tsMethodsByFile.set(file, methods);
        }
      }
    }

    // Collect all Ruby classes and modules with their methods
    const allRuby: {
      fqn: string;
      info: ClassInfo;
    }[] = [];

    for (const [fqn, info] of Object.entries(rubyPkg.classes)) {
      allRuby.push({ fqn, info: info as unknown as ClassInfo });
    }

    // Fold ClassMethods into parent module
    const classMethodModuleFqns = new Set<string>();
    for (const [fqn, info] of Object.entries(rubyPkg.modules)) {
      if (!fqn.endsWith("::ClassMethods")) continue;
      const parentFqn = fqn.replace(/::ClassMethods$/, "");
      const parentMod = rubyPkg.modules[parentFqn] as unknown as ClassInfo | undefined;
      if (parentMod) {
        const mod = info as unknown as ClassInfo;
        for (const m of mod.instanceMethods) {
          if (!parentMod.classMethods.some((pm: MethodInfo) => pm.name === m.name)) {
            parentMod.classMethods.push(m);
          }
        }
        classMethodModuleFqns.add(fqn);
      }
    }

    for (const [fqn, info] of Object.entries(rubyPkg.modules)) {
      const mod = info as unknown as ClassInfo;
      if (classMethodModuleFqns.has(fqn)) continue;
      if (
        mod.instanceMethods.length === 0 &&
        mod.classMethods.length === 0 &&
        mod.includes.length === 0 &&
        mod.extends.length === 0
      ) {
        continue;
      }
      allRuby.push({ fqn, info: mod });
    }

    // Build module FQN → short name mapping for include resolution.
    // Ruby `include Predications` uses the short name, but the module FQN
    // might be `Arel::Predications`. Build both short and full lookups.
    const moduleFqnByShort = new Map<string, string[]>();
    for (const [fqn] of Object.entries(rubyPkg.modules)) {
      const short = fqn.split("::").pop()!;
      const list = moduleFqnByShort.get(short) || [];
      list.push(fqn);
      moduleFqnByShort.set(short, list);
    }

    // For each Ruby module, find the TS files of classes that include it.
    // If a module's methods aren't in the module's own file, they may be
    // implemented directly on the including class (common TS pattern).
    const moduleIncluderFiles = new Map<string, Set<string>>();
    const allClassesAndModules = [
      ...Object.entries(rubyPkg.classes).map(([fqn, info]) => ({
        fqn,
        info: info as unknown as ClassInfo,
      })),
      ...Object.entries(rubyPkg.modules).map(([fqn, info]) => ({
        fqn,
        info: info as unknown as ClassInfo,
      })),
    ];
    for (const { info } of allClassesAndModules) {
      if (!info.file) continue;
      const includerTsFile = rubyFileToTs(info.file);
      for (const inc of [...(info.includes || []), ...(info.extends || [])]) {
        // Resolve short name to FQN(s)
        const fqns = moduleFqnByShort.get(inc) || [inc];
        for (const fqn of fqns) {
          const files = moduleIncluderFiles.get(fqn) || new Set();
          files.add(includerTsFile);
          moduleIncluderFiles.set(fqn, files);
        }
      }
    }

    // Group by Ruby file
    const byFile = new Map<string, typeof allRuby>();
    for (const item of allRuby) {
      const file = item.info.file || "unknown.rb";
      const list = byFile.get(file) || [];
      list.push(item);
      byFile.set(file, list);
    }

    // Compare methods per file
    let totalMatched = 0;
    let totalMissing = 0;
    const fileResults: FileResult[] = [];

    for (const [rubyFile, items] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const expectedTs = rubyFileToTs(rubyFile);
      const tsMethods = tsMethodsByFile.get(expectedTs) || new Set<string>();
      const tsFileExists = tsMethodsByFile.has(expectedTs);
      const missingMethods: MethodResult[] = [];
      let fileMatched = 0;
      let fileMissing = 0;

      for (const item of items) {
        // For modules, also check files of classes that include this module
        const includerFiles = moduleIncluderFiles.get(item.fqn);
        const includerMethodSets: Set<string>[] = [];
        if (includerFiles) {
          for (const f of includerFiles) {
            const methods = tsMethodsByFile.get(f);
            if (methods) includerMethodSets.push(methods);
          }
        }

        const rubyMethods = [...item.info.instanceMethods, ...item.info.classMethods];

        for (const rm of rubyMethods) {
          const tsName = rubyMethodToTs(rm.name);
          if (tsName === null) continue;

          if (tsMethods.has(tsName)) {
            fileMatched++;
          } else if (includerMethodSets.some((s) => s.has(tsName))) {
            // Found on an including class — counts as matched
            fileMatched++;
          } else {
            fileMissing++;
            missingMethods.push({
              rubyName: rm.name,
              tsName,
              rubyModule: item.fqn,
            });
          }
        }
      }

      const total = fileMatched + fileMissing;
      if (total > 0) {
        fileResults.push({
          rubyFile,
          expectedTsFile: expectedTs,
          tsFileExists,
          matched: fileMatched,
          missing: fileMissing,
          total,
          missingMethods,
        });
      }

      totalMatched += fileMatched;
      totalMissing += fileMissing;
    }

    const totalMethods = totalMatched + totalMissing;
    const pct = totalMethods > 0 ? Math.round((totalMatched / totalMethods) * 1000) / 10 : 0;

    results.push({
      package: pkg,
      totalMethods,
      matched: totalMatched,
      missing: totalMissing,
      percent: pct,
      files: fileResults,
    });
  }

  // Write JSON
  const jsonPath = path.join(OUTPUT_DIR, "api-comparison.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
  );

  printReport(results, showMissing, showFiles, filterPkg);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport(
  results: PackageResult[],
  showMissing: boolean,
  showFiles: boolean,
  filterPkg: string | null,
) {
  let grandTotal = 0;
  let grandMatched = 0;

  for (const pkg of results) {
    grandTotal += pkg.totalMethods;
    grandMatched += pkg.matched;

    console.log(`\n${"=".repeat(100)}`);
    console.log(
      `  ${pkg.package}  —  ${pkg.matched}/${pkg.totalMethods} methods (${pkg.percent}%)  |  ${pkg.missing} missing`,
    );
    console.log(`${"=".repeat(100)}`);

    // Per-file table (only for detail packages or when filtered)
    if (DETAIL_PACKAGES.has(pkg.package) || filterPkg || showFiles) {
      console.log(
        `\n  ${"Ruby file".padEnd(55)} ${"Expected TS file".padEnd(40)} ${"Match".padStart(6)} ${"Miss".padStart(6)} ${"Tot".padStart(6)}  %`,
      );
      console.log(
        `  ${"-".repeat(55)} ${"-".repeat(40)} ${"-".repeat(6)} ${"-".repeat(6)} ${"-".repeat(6)} ${"-".repeat(4)}`,
      );

      for (const f of pkg.files) {
        const pct = f.total > 0 ? Math.round((f.matched / f.total) * 100) : 0;
        const marker = !f.tsFileExists ? " \u2717" : f.matched === f.total ? " \u2713" : "";
        console.log(
          `  ${f.rubyFile.padEnd(55)} ${f.expectedTsFile.padEnd(40)} ${String(f.matched).padStart(6)} ${String(f.missing).padStart(6)} ${String(f.total).padStart(6)} ${String(pct).padStart(3)}%${marker}`,
        );

        if (showMissing) {
          for (const m of f.missingMethods.slice(0, 10)) {
            console.log(`      - ${m.rubyName} → ${m.tsName}`);
          }
          if (f.missingMethods.length > 10) {
            console.log(`      ... and ${f.missingMethods.length - 10} more`);
          }
        }
      }
    }
  }

  const grandPct = grandTotal > 0 ? Math.round((grandMatched / grandTotal) * 1000) / 10 : 0;
  const grandMissing = grandTotal - grandMatched;
  console.log(`\n${"=".repeat(100)}`);
  console.log(
    `  Overall: ${grandMatched}/${grandTotal} methods (${grandPct}%)  |  ${grandMissing} missing`,
  );
  console.log(`${"=".repeat(100)}\n`);
}

main();
