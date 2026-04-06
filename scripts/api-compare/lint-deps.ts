#!/usr/bin/env npx tsx
/**
 * Cross-package dependency lint.
 *
 * For each Rails method that uses a sibling package (e.g., ActiveRecord using
 * Arel), checks that the corresponding TypeScript method also uses the TS
 * equivalent. Optionally adds JSDoc annotations to TS methods documenting
 * the expected dependency.
 *
 * Usage:
 *   npx tsx scripts/api-compare/lint-deps.ts [--package activerecord] [--dep arel] [--fix]
 */

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import type { ApiManifest, ClassInfo, MethodInfo } from "./types.js";
import { OUTPUT_DIR, packageSrcDir } from "./config.js";
import { rubyFileToTs, rubyMethodToTs } from "./conventions.js";

// ---------------------------------------------------------------------------
// Dependency rules — add new entries to extend to other packages
// ---------------------------------------------------------------------------

interface DepRule {
  package: string;
  dependency: string;
  tsImport: string;
  jsdocTag: string;
}

const RULES: DepRule[] = [
  {
    package: "activerecord",
    dependency: "arel",
    tsImport: "@blazetrails/arel",
    jsdocTag: "@arel",
  },
];

// ---------------------------------------------------------------------------
// CLI argument parsing
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
    fix: args.includes("--fix"),
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
  const process = (entities: Record<string, unknown>) => {
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
  process(rubyPkg.classes);
  process(rubyPkg.modules);
  return results;
}

// ---------------------------------------------------------------------------
// TS analysis: detect dependency usage per method
// ---------------------------------------------------------------------------

type DepStatus = "uses" | "suppressed" | "missing";
type TsDepMap = Map<string, Map<string, DepStatus>>; // file -> method -> status

function analyzeTsDepUsage(pkgSrcDir: string, tsImport: string, jsdocTag: string): TsDepMap {
  const result: TsDepMap = new Map();

  const allFiles = getAllTsFiles(pkgSrcDir);
  if (allFiles.length === 0) return result;

  const program = ts.createProgram(allFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
  });

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.fileName.startsWith(pkgSrcDir)) continue;
    if (sourceFile.fileName.endsWith(".test.ts")) continue;
    if (sourceFile.fileName.endsWith(".d.ts")) continue;

    const relPath = path.relative(pkgSrcDir, sourceFile.fileName);

    // Step 1: collect all import bindings from the target import
    const importedNames = new Set<string>();
    for (const stmt of sourceFile.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;
      const specifier = (stmt.moduleSpecifier as ts.StringLiteral).text;
      if (specifier !== tsImport) continue;
      const clause = stmt.importClause;
      if (!clause) continue;
      if (clause.name) importedNames.add(clause.name.text);
      if (clause.namedBindings) {
        if (ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) {
            importedNames.add(el.name.text);
          }
        } else if (ts.isNamespaceImport(clause.namedBindings)) {
          importedNames.add(clause.namedBindings.name.text);
        }
      }
    }

    if (importedNames.size === 0) {
      // File has no imports from the target package
      const methodMap = new Map<string, DepStatus>();
      visitMethodDeclarations(sourceFile, (name, _body, node) => {
        const suppressed = hasJsDocTag(sourceFile, node, jsdocTag);
        methodMap.set(name, suppressed ? "suppressed" : "missing");
      });
      if (methodMap.size > 0) result.set(relPath, methodMap);
      continue;
    }

    // Step 2: for each method, check if body references any imported name
    const methodMap = new Map<string, DepStatus>();
    visitMethodDeclarations(sourceFile, (name, bodyNode, node) => {
      if (bodyNode && bodyReferencesImports(bodyNode, importedNames)) {
        methodMap.set(name, "uses");
      } else {
        const suppressed = hasJsDocTag(sourceFile, node, jsdocTag);
        methodMap.set(name, suppressed ? "suppressed" : "missing");
      }
    });
    if (methodMap.size > 0) result.set(relPath, methodMap);
  }

  return result;
}

function visitMethodDeclarations(
  sourceFile: ts.SourceFile,
  callback: (name: string, body: ts.Node | undefined, node: ts.Node) => void,
) {
  const visit = (node: ts.Node) => {
    if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      callback(node.name.text, node.body, node);
      return;
    }
    if (ts.isGetAccessorDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      callback(node.name.text, node.body, node);
      return;
    }
    if (ts.isSetAccessorDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      callback(node.name.text, node.body, node);
      return;
    }
    if (ts.isConstructorDeclaration(node)) {
      callback("constructor", node.body, node);
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      callback(node.name.text, node.body, node);
      return;
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            callback(decl.name.text, decl.initializer.body, node);
          }
        }
      }
      return;
    }
    if (ts.isPropertyDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      if (
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        callback(node.name.text, node.initializer.body, node);
        return;
      }
    }

    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
}

function hasJsDocTag(sourceFile: ts.SourceFile, node: ts.Node, tag: string): boolean {
  const fullText = sourceFile.getFullText();
  const fullStart = node.getFullStart();
  const start = node.getStart(sourceFile);
  const leading = fullText.slice(fullStart, start);
  return leading.includes(tag);
}

function bodyReferencesImports(body: ts.Node, importedNames: Set<string>): boolean {
  let found = false;
  const check = (node: ts.Node) => {
    if (found) return;
    if (ts.isIdentifier(node) && importedNames.has(node.text)) {
      found = true;
      return;
    }
    ts.forEachChild(node, check);
  };
  check(body);
  return found;
}

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".d.ts")
      ) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Cross-reference: match Ruby dep methods to TS methods
// ---------------------------------------------------------------------------

interface Violation {
  rubyFile: string;
  tsFile: string;
  rubyMethod: string;
  tsMethod: string;
  rubyModule: string;
  depRefs: string[];
}

interface Suppressed {
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
): {
  violations: Violation[];
  suppressed: Suppressed[];
  compliant: Compliant[];
  unmatched: Unmatched[];
} {
  const violations: Violation[] = [];
  const suppressed: Suppressed[] = [];
  const compliant: Compliant[] = [];
  const unmatched: Unmatched[] = [];

  // Deduplicate: same ruby method name in same file (from multiple classes)
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
      unmatched.push({ rubyFile: rm.rubyFile, rubyMethod: rm.rubyName, rubyModule: rm.rubyModule });
      continue;
    }

    // Find matching TS method
    let matchedTsName: string | null = null;
    let status: DepStatus = "missing";
    for (const candidate of tsCandidates) {
      if (fileMethods.has(candidate)) {
        matchedTsName = candidate;
        status = fileMethods.get(candidate)!;
        break;
      }
    }

    if (!matchedTsName) {
      unmatched.push({ rubyFile: rm.rubyFile, rubyMethod: rm.rubyName, rubyModule: rm.rubyModule });
      continue;
    }

    const entry = {
      rubyFile: rm.rubyFile,
      tsFile,
      rubyMethod: rm.rubyName,
      tsMethod: matchedTsName,
      rubyModule: rm.rubyModule,
    };
    if (status === "uses") {
      compliant.push(entry);
    } else if (status === "suppressed") {
      suppressed.push({ ...entry, depRefs: rm.depRefs });
    } else {
      violations.push({ ...entry, depRefs: rm.depRefs });
    }
  }

  return { violations, suppressed, compliant, unmatched };
}

// ---------------------------------------------------------------------------
// JSDoc fix: add @arel (or other) tag to TS methods
// ---------------------------------------------------------------------------

function applyJsDocFixes(violations: Violation[], pkgSrcDir: string, rule: DepRule) {
  // Group violations by TS file
  const byFile = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = byFile.get(v.tsFile) || [];
    list.push(v);
    byFile.set(v.tsFile, list);
  }

  let fixedCount = 0;

  for (const [tsFile, fileViolations] of byFile) {
    const absPath = path.join(pkgSrcDir, tsFile);
    if (!fs.existsSync(absPath)) continue;

    const source = fs.readFileSync(absPath, "utf-8");
    const sourceFile = ts.createSourceFile(tsFile, source, ts.ScriptTarget.ESNext, true);

    // Collect ALL method nodes, deduplicating by position so we only annotate
    // each physical method declaration once (even if multiple Ruby classes map to it).
    const violationsByMethod = new Map(fileViolations.map((v) => [v.tsMethod, v]));
    const methodsNeedingDoc: { name: string; node: ts.Node; violation: Violation }[] = [];
    const seenPositions = new Set<number>();

    const visit = (node: ts.Node) => {
      let methodName: string | null = null;

      if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        methodName = node.name.text;
      } else if (ts.isGetAccessorDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        methodName = node.name.text;
      } else if (ts.isSetAccessorDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        methodName = node.name.text;
      } else if (ts.isConstructorDeclaration(node)) {
        methodName = "constructor";
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        methodName = node.name.text;
      } else if (ts.isPropertyDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        if (
          node.initializer &&
          (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        ) {
          methodName = node.name.text;
        }
      }

      if (methodName && violationsByMethod.has(methodName)) {
        const pos = node.getStart();
        if (!seenPositions.has(pos)) {
          seenPositions.add(pos);
          const v = violationsByMethod.get(methodName)!;
          const existingJsDoc = getLeadingJsDoc(source, node);
          if (!existingJsDoc || !existingJsDoc.includes(rule.jsdocTag)) {
            methodsNeedingDoc.push({ name: methodName, node, violation: v });
          }
        }
      }

      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);

    if (methodsNeedingDoc.length === 0) continue;

    // Apply edits in reverse position order to preserve character offsets
    methodsNeedingDoc.sort((a, b) => b.node.getStart() - a.node.getStart());

    // Since we process in reverse position order, each edit only affects
    // positions after it. We can use original positions and apply to modified.
    let modified = source;
    for (const { node, violation } of methodsNeedingDoc) {
      const refs = violation.depRefs.slice(0, 5).join(", ");
      const indent = getIndentAtNode(source, node);
      const hasDoc = hasExistingJsDoc(source, node);
      const tag = `${rule.jsdocTag} ${refs}`;

      if (hasDoc) {
        const closePos = findExistingJsDocClosePos(source, node);
        if (closePos !== null) {
          const insertLine = `\n${indent} * ${tag}\n${indent} `;
          modified = modified.slice(0, closePos) + insertLine + modified.slice(closePos);
        }
      } else {
        const insertPos = findInsertionPoint(source, node);
        const jsDocComment = `${indent}/** ${tag} */\n`;
        modified = modified.slice(0, insertPos) + jsDocComment + modified.slice(insertPos);
      }

      fixedCount++;
    }

    fs.writeFileSync(absPath, modified);
  }

  return fixedCount;
}

function getLeadingJsDoc(source: string, node: ts.Node): string | null {
  const fullStart = node.getFullStart();
  const start = node.getStart();
  const leading = source.slice(fullStart, start);
  const jsDocMatch = leading.match(/\/\*\*[\s\S]*?\*\//);
  return jsDocMatch ? jsDocMatch[0] : null;
}

function getIndentAtNode(source: string, node: ts.Node): string {
  // Use node.getStart() which skips trivia (comments/whitespace) to find
  // the actual start of the declaration keyword
  const start = node.getStart();
  let lineStart = start;
  while (lineStart > 0 && source[lineStart - 1] !== "\n") lineStart--;
  return source.slice(lineStart, start).match(/^(\s*)/)?.[1] || "";
}

function findInsertionPoint(source: string, node: ts.Node): number {
  // Find where to insert the JSDoc — right before the declaration keyword,
  // but after any existing leading whitespace on that line.
  const start = node.getStart();
  let lineStart = start;
  while (lineStart > 0 && source[lineStart - 1] !== "\n") lineStart--;
  return lineStart;
}

function hasExistingJsDoc(source: string, node: ts.Node): boolean {
  const fullStart = node.getFullStart();
  const start = node.getStart();
  const leading = source.slice(fullStart, start);
  return /\/\*\*[\s\S]*?\*\//.test(leading);
}

function findExistingJsDocClosePos(source: string, node: ts.Node): number | null {
  const fullStart = node.getFullStart();
  const start = node.getStart();
  const leading = source.slice(fullStart, start);
  const match = leading.match(/\/\*\*[\s\S]*?\*\//);
  if (!match) return null;
  return fullStart + match.index! + match[0].lastIndexOf("*/");
}

function findMethodNode(sourceFile: ts.SourceFile, methodName: string): ts.Node | null {
  let found: ts.Node | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      ts.isMethodDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === methodName
    ) {
      found = node;
    } else if (
      ts.isGetAccessorDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === methodName
    ) {
      found = node;
    } else if (
      ts.isSetAccessorDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === methodName
    ) {
      found = node;
    } else if (ts.isConstructorDeclaration(node) && methodName === "constructor") {
      found = node;
    } else if (ts.isFunctionDeclaration(node) && node.name && node.name.text === methodName) {
      found = node;
    } else if (
      ts.isPropertyDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === methodName
    ) {
      found = node;
    } else {
      ts.forEachChild(node, visit);
    }
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

interface LintResult {
  rule: DepRule;
  violations: Violation[];
  suppressed: Suppressed[];
  compliant: Compliant[];
  unmatched: Unmatched[];
}

function printReport(results: LintResult[], fix: boolean) {
  for (const { rule, violations, suppressed, compliant, unmatched } of results) {
    const total = violations.length + suppressed.length + compliant.length;
    const pct =
      total > 0 ? Math.round(((compliant.length + suppressed.length) / total) * 1000) / 10 : 100;

    console.log(`\nDependency Lint -- ${rule.package} -> ${rule.dependency}`);
    console.log("=".repeat(60));

    // Group by TS file
    const violationsByFile = new Map<string, Violation[]>();
    for (const v of violations) {
      const list = violationsByFile.get(v.tsFile) || [];
      list.push(v);
      violationsByFile.set(v.tsFile, list);
    }

    const suppressedByFile = new Map<string, Suppressed[]>();
    for (const s of suppressed) {
      const list = suppressedByFile.get(s.tsFile) || [];
      list.push(s);
      suppressedByFile.set(s.tsFile, list);
    }

    const compliantByFile = new Map<string, Compliant[]>();
    for (const c of compliant) {
      const list = compliantByFile.get(c.tsFile) || [];
      list.push(c);
      compliantByFile.set(c.tsFile, list);
    }

    const allFiles = new Set([
      ...violationsByFile.keys(),
      ...suppressedByFile.keys(),
      ...compliantByFile.keys(),
    ]);
    for (const f of [...allFiles].sort()) {
      const fv = violationsByFile.get(f) || [];
      const fs_ = suppressedByFile.get(f) || [];
      const fc = compliantByFile.get(f) || [];
      if (fv.length === 0 && fs_.length === 0) continue;

      console.log(`\n  ${f}`);
      for (const v of fv) {
        const refs = v.depRefs.slice(0, 3).join(", ");
        console.log(`    \u2717 ${v.tsMethod} -- Rails uses ${rule.dependency} (${refs})`);
      }
      for (const s of fs_) {
        console.log(`    ~ ${s.tsMethod} (suppressed)`);
      }
      for (const c of fc) {
        console.log(`    \u2713 ${c.tsMethod}`);
      }
    }

    console.log(
      `\n  Summary: ${compliant.length} compliant, ${suppressed.length} suppressed, ${violations.length} violations (${total} total)`,
    );
    if (unmatched.length > 0) {
      console.log(
        `           ${unmatched.length} Rails ${rule.dependency}-using methods not yet implemented in TS`,
      );
    }

    if (violations.length > 0 && !fix) {
      console.log(`\n  Run with --fix to suppress violations with ${rule.jsdocTag} JSDoc tags.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { filterPkg, filterDep, fix } = parseArgs();

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
  let totalViolations = 0;

  for (const rule of activeRules) {
    console.log(`Analyzing ${rule.package} -> ${rule.dependency}...`);

    const rubyMethods = collectRubyDepMethods(ruby, rule.package, rule.dependency);
    console.log(`  Found ${rubyMethods.length} Rails methods using ${rule.dependency}`);

    const pkgSrcDir = packageSrcDir(rule.package);
    const tsDepMap = analyzeTsDepUsage(pkgSrcDir, rule.tsImport, rule.jsdocTag);

    const { violations, suppressed, compliant, unmatched } = crossReference(rubyMethods, tsDepMap);

    if (fix && violations.length > 0) {
      const fixedCount = applyJsDocFixes(violations, pkgSrcDir, rule);
      console.log(`  Suppressed ${fixedCount} violations with ${rule.jsdocTag} JSDoc tags`);
    }

    allResults.push({ rule, violations, suppressed, compliant, unmatched });
    totalViolations += violations.length;
  }

  // Write JSON report
  const report = {
    generatedAt: new Date().toISOString(),
    rules: allResults.map(({ rule, violations, suppressed, compliant, unmatched }) => {
      const matched = violations.length + suppressed.length + compliant.length;
      return {
        package: rule.package,
        dependency: rule.dependency,
        summary: {
          rubyDepMethods: matched + unmatched.length,
          tsMatchedCompliant: compliant.length,
          tsMatchedSuppressed: suppressed.length,
          tsMatchedViolations: violations.length,
          tsUnmatched: unmatched.length,
        },
        violations,
        suppressed,
        compliant,
        unmatched,
      };
    }),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, "dep-lint.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  printReport(allResults, fix);

  if (totalViolations > 0 && !fix) {
    process.exit(1);
  }
}

main();
