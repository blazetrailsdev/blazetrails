#!/usr/bin/env npx tsx
/**
 * Cross-package dependency lint.
 *
 * For each Rails method that uses a sibling package (e.g., ActiveRecord → Arel),
 * checks whether the corresponding TypeScript method also uses it. Reports a
 * score and per-file details, similar to api:compare.
 *
 * Usage:
 *   npx tsx scripts/api-compare/lint-deps.ts [--package activerecord] [--dep arel]
 */

import * as fs from "fs";
import * as path from "path";
import type { ApiManifest, ClassInfo } from "./types.js";
import { OUTPUT_DIR, packageSrcDir } from "./config.js";
import { rubyFileToTs, rubyMethodToTs } from "./conventions.js";

// ---------------------------------------------------------------------------
// Dependency rules — add new entries to extend to other packages
// ---------------------------------------------------------------------------

interface DepRule {
  package: string;
  dependency: string;
  tsImport: string;
  tsIdentifiers: string[];
}

const RULES: DepRule[] = [
  {
    package: "activerecord",
    dependency: "arel",
    tsImport: "@blazetrails/arel",
    tsIdentifiers: ["arelTable"],
  },
];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    filterPkg: get("--package") ?? null,
    filterDep: get("--dep") ?? null,
  };
}

// ---------------------------------------------------------------------------
// Ruby manifest: collect methods that use a given dependency
// ---------------------------------------------------------------------------

interface RubyDepMethod {
  rubyName: string;
  rubyModule: string;
  rubyFile: string;
  depRefs: string[];
}

function collectRubyDepMethods(ruby: ApiManifest, pkg: string, dep: string): RubyDepMethod[] {
  const rubyPkg = ruby.packages[pkg];
  if (!rubyPkg) return [];

  const results: RubyDepMethod[] = [];
  const scan = (entities: Record<string, unknown>) => {
    for (const [fqn, raw] of Object.entries(entities)) {
      const info = raw as ClassInfo;
      for (const m of [...info.instanceMethods, ...info.classMethods]) {
        if (m.deps?.includes(dep)) {
          results.push({
            rubyName: m.name,
            rubyModule: fqn,
            rubyFile: m.file || info.file || "",
            depRefs: m.depRefs?.[dep] || [],
          });
        }
      }
    }
  };
  scan(rubyPkg.classes);
  scan(rubyPkg.modules);
  return results;
}

// ---------------------------------------------------------------------------
// TS analysis: per-file dep usage via text scanning (no TS program needed)
// ---------------------------------------------------------------------------

type TsDepMap = Map<string, Map<string, boolean>>; // file -> method -> usesDep

function analyzeTsDepUsage(pkgSrcDir: string, tsImport: string, tsIdentifiers: string[]): TsDepMap {
  const result: TsDepMap = new Map();
  const files = getAllTsFiles(pkgSrcDir);

  for (const filePath of files) {
    const relPath = path.relative(pkgSrcDir, filePath);
    const source = fs.readFileSync(filePath, "utf-8");

    // Collect import bindings from the target package
    const importedNames = collectImportBindings(source, tsImport);
    const searchTerms = new Set([...importedNames, ...tsIdentifiers]);

    // Fast path: if no imports and no identifiers to check, all methods miss
    if (searchTerms.size === 0) continue;

    // Extract methods and check if their bodies reference any search term.
    // Uses a lightweight regex approach instead of a full TS program — much
    // faster and sufficient for identifier presence checks.
    const methods = extractMethodBodies(source);
    const methodMap = new Map<string, boolean>();
    for (const { name, body } of methods) {
      const uses = searchTerms.size > 0 && bodyContainsAny(body, searchTerms);
      const existing = methodMap.get(name);
      if (existing === undefined || uses) methodMap.set(name, uses);
    }
    if (methodMap.size > 0) result.set(relPath, methodMap);
  }

  return result;
}

/** Extract named import bindings from `import { A, B } from "pkg"` statements. */
function collectImportBindings(source: string, targetImport: string): Set<string> {
  const names = new Set<string>();
  const escaped = targetImport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`import\\s*(?:type\\s+)?\\{([^}]+)\\}\\s*from\\s*["']${escaped}["']`, "g");
  for (const m of source.matchAll(re)) {
    for (const binding of m[1].split(",")) {
      const name = binding
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  // Handle namespace imports: import * as Arel from "pkg"
  const nsRe = new RegExp(`import\\s*\\*\\s*as\\s+(\\w+)\\s*from\\s*["']${escaped}["']`, "g");
  for (const m of source.matchAll(nsRe)) {
    names.add(m[1]);
  }
  return names;
}

interface MethodBody {
  name: string;
  body: string;
}

/**
 * Extract method/function names and their body text from TS source.
 * Finds declaration keywords/names, skips past parenthesized params
 * (handling nesting), then extracts the brace-delimited body.
 */
function extractMethodBodies(source: string): MethodBody[] {
  const results: MethodBody[] = [];

  // Match the declaration head — we just need the name and position.
  // The regex stops before params; we handle parens + body manually.
  const declRe =
    /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+))|(?:(?:async\s+)?(?:(?:get|set)\s+)?(\w+))\s*\(|(?:constructor)\s*\(/g;

  for (const match of source.matchAll(declRe)) {
    const name = match[1] ?? match[2] ?? "constructor";
    // Skip noise from control flow
    if (
      /^(if|for|while|switch|catch|return|throw|new|await|typeof|import|from|else|case|argument)$/.test(
        name,
      )
    )
      continue;

    // Find the opening paren after the name
    let pos = match.index! + match[0].length;
    if (match[1]) {
      // function declaration: regex stopped after name, find the paren
      while (pos < source.length && source[pos] !== "(") pos++;
    } else {
      // method/constructor: regex included the paren, back up
      pos--;
    }
    if (pos >= source.length || source[pos] !== "(") continue;

    // Skip past balanced parens
    pos = skipBalanced(source, pos, "(", ")");
    if (pos === -1) continue;

    // Skip return type annotation and whitespace until {
    while (pos < source.length && source[pos] !== "{") {
      if (source[pos] === "=" && source[pos + 1] === ">") {
        // Arrow function — skip =>
        pos += 2;
        while (pos < source.length && /\s/.test(source[pos])) pos++;
        break;
      }
      pos++;
    }
    if (pos >= source.length || source[pos] !== "{") continue;

    const body = extractBraceBlock(source, pos);
    if (body !== null) results.push({ name, body });
  }

  return results;
}

function skipBalanced(source: string, start: number, open: string, close: string): number {
  let depth = 1;
  let i = start + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === open) depth++;
    else if (ch === close) depth--;
    else if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i);
      continue;
    }
    i++;
  }
  return depth === 0 ? i : -1;
}

function extractBraceBlock(source: string, openBrace: number): string | null {
  let depth = 1;
  let i = openBrace + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i);
      continue;
    } else if (ch === "/" && source[i + 1] === "/") {
      // Skip line comment
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    } else if (ch === "/" && source[i + 1] === "*") {
      // Skip block comment
      i = source.indexOf("*/", i + 2);
      if (i === -1) return null;
      i += 2;
      continue;
    }
    i++;
  }
  return depth === 0 ? source.slice(openBrace + 1, i - 1) : null;
}

function skipString(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  if (quote === "`") {
    // Template literal — handle ${} nesting
    let depth = 0;
    while (i < source.length) {
      if (source[i] === "\\" && i + 1 < source.length) {
        i += 2;
        continue;
      }
      if (source[i] === "`" && depth === 0) return i + 1;
      if (source[i] === "$" && source[i + 1] === "{") {
        depth++;
        i += 2;
        continue;
      }
      if (source[i] === "}" && depth > 0) {
        depth--;
        i++;
        continue;
      }
      i++;
    }
  } else {
    while (i < source.length) {
      if (source[i] === "\\" && i + 1 < source.length) {
        i += 2;
        continue;
      }
      if (source[i] === quote) return i + 1;
      i++;
    }
  }
  return i;
}

/** Check if body text contains any of the search terms as whole words. */
function bodyContainsAny(body: string, terms: Set<string>): boolean {
  for (const term of terms) {
    // Use word boundary check to avoid matching substrings
    const idx = body.indexOf(term);
    if (idx === -1) continue;
    const before = idx > 0 ? body[idx - 1] : " ";
    const after = idx + term.length < body.length ? body[idx + term.length] : " ";
    if (/\w/.test(before) || /\w/.test(after)) {
      // Could be a substring match — do a regex check
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (re.test(body)) return true;
    } else {
      return true;
    }
  }
  return false;
}

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".d.ts")
      )
        results.push(full);
    }
  };
  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Cross-reference
// ---------------------------------------------------------------------------

interface Violation {
  rubyFile: string;
  tsFile: string;
  rubyMethod: string;
  tsMethod: string;
  rubyModule: string;
  depRefs: string[];
}

interface Compliant {
  rubyFile: string;
  tsFile: string;
  rubyMethod: string;
  tsMethod: string;
  rubyModule: string;
}

interface Unmatched {
  rubyFile: string;
  rubyMethod: string;
  rubyModule: string;
}

function crossReference(
  rubyMethods: RubyDepMethod[],
  tsDepMap: TsDepMap,
): { violations: Violation[]; compliant: Compliant[]; unmatched: Unmatched[] } {
  const violations: Violation[] = [];
  const compliant: Compliant[] = [];
  const unmatched: Unmatched[] = [];
  const seen = new Set<string>();

  for (const rm of rubyMethods) {
    const tsCandidates = rubyMethodToTs(rm.rubyName);
    if (!tsCandidates) continue;

    const tsFile = rubyFileToTs(rm.rubyFile);
    const dedupeKey = `${tsFile}:${tsCandidates[0]}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const fileMethods = tsDepMap.get(tsFile);
    if (!fileMethods) {
      unmatched.push({
        rubyFile: rm.rubyFile,
        rubyMethod: rm.rubyName,
        rubyModule: rm.rubyModule,
      });
      continue;
    }

    let matchedTsName: string | null = null;
    let uses = false;
    for (const candidate of tsCandidates) {
      if (fileMethods.has(candidate)) {
        matchedTsName = candidate;
        uses = fileMethods.get(candidate)!;
        break;
      }
    }

    if (!matchedTsName) {
      unmatched.push({
        rubyFile: rm.rubyFile,
        rubyMethod: rm.rubyName,
        rubyModule: rm.rubyModule,
      });
      continue;
    }

    const entry = {
      rubyFile: rm.rubyFile,
      tsFile,
      rubyMethod: rm.rubyName,
      tsMethod: matchedTsName,
      rubyModule: rm.rubyModule,
    };
    if (uses) compliant.push(entry);
    else violations.push({ ...entry, depRefs: rm.depRefs });
  }

  return { violations, compliant, unmatched };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

interface LintResult {
  rule: DepRule;
  violations: Violation[];
  compliant: Compliant[];
  unmatched: Unmatched[];
}

function printReport(results: LintResult[]) {
  for (const { rule, violations, compliant, unmatched } of results) {
    const total = violations.length + compliant.length;
    const pct = total > 0 ? Math.round((compliant.length / total) * 1000) / 10 : 100;

    console.log(`\nDependency Lint -- ${rule.package} -> ${rule.dependency}`);
    console.log("=".repeat(60));

    // Group violations by file for per-file display
    const violationsByFile = new Map<string, Violation[]>();
    for (const v of violations) {
      const list = violationsByFile.get(v.tsFile) || [];
      list.push(v);
      violationsByFile.set(v.tsFile, list);
    }

    const compliantByFile = new Map<string, Compliant[]>();
    for (const c of compliant) {
      const list = compliantByFile.get(c.tsFile) || [];
      list.push(c);
      compliantByFile.set(c.tsFile, list);
    }

    const allFiles = new Set([...violationsByFile.keys(), ...compliantByFile.keys()]);
    for (const f of [...allFiles].sort()) {
      const fv = violationsByFile.get(f) || [];
      const fc = compliantByFile.get(f) || [];
      if (fv.length === 0) continue;

      console.log(`\n  ${f}`);
      for (const v of fv) {
        const refs = v.depRefs.slice(0, 3).join(", ");
        console.log(`    \u2717 ${v.tsMethod} -- Rails uses ${rule.dependency} (${refs})`);
      }
      for (const c of fc) {
        console.log(`    \u2713 ${c.tsMethod}`);
      }
    }

    console.log(`\n  ${compliant.length}/${total} methods use ${rule.dependency} (${pct}%)`);
    if (violations.length > 0) {
      console.log(`  ${violations.length} methods need ${rule.dependency} migration`);
    }
    if (unmatched.length > 0) {
      console.log(
        `  ${unmatched.length} Rails ${rule.dependency}-using methods not yet implemented in TS`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { filterPkg, filterDep } = parseArgs();

  const rubyPath = path.join(OUTPUT_DIR, "rails-api.json");
  if (!fs.existsSync(rubyPath)) {
    console.error("Missing rails-api.json -- run extract-ruby-api.rb first");
    process.exit(1);
  }
  const ruby: ApiManifest = JSON.parse(fs.readFileSync(rubyPath, "utf-8"));

  const activeRules = RULES.filter((r) => {
    if (filterPkg && r.package !== filterPkg) return false;
    if (filterDep && r.dependency !== filterDep) return false;
    return true;
  });

  if (activeRules.length === 0) {
    console.error("No matching dependency rules found.");
    console.error("Available rules:");
    for (const r of RULES) {
      console.error(`  --package ${r.package} --dep ${r.dependency}`);
    }
    process.exit(1);
  }

  const allResults: LintResult[] = [];

  for (const rule of activeRules) {
    const rubyMethods = collectRubyDepMethods(ruby, rule.package, rule.dependency);

    const pkgSrcDir = packageSrcDir(rule.package);
    const tsDepMap = analyzeTsDepUsage(pkgSrcDir, rule.tsImport, rule.tsIdentifiers);

    const { violations, compliant, unmatched } = crossReference(rubyMethods, tsDepMap);
    allResults.push({ rule, violations, compliant, unmatched });
  }

  // Write JSON report
  const report = {
    generatedAt: new Date().toISOString(),
    rules: allResults.map(({ rule, violations, compliant, unmatched }) => ({
      package: rule.package,
      dependency: rule.dependency,
      summary: {
        compliant: compliant.length,
        violations: violations.length,
        unmatched: unmatched.length,
        total: violations.length + compliant.length,
        percent:
          violations.length + compliant.length > 0
            ? Math.round((compliant.length / (violations.length + compliant.length)) * 1000) / 10
            : 100,
      },
      violations,
      compliant,
      unmatched,
    })),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, "dep-lint.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  printReport(allResults);
}

main();
