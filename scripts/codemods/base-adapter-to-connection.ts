#!/usr/bin/env tsx
/**
 * Base.adapter / this.adapter → Base.connection / this.connection codemod.
 *
 * Type-aware rename built on the TypeScript Compiler API. Only `.adapter`
 * member-access expressions whose accessed symbol resolves to the deprecated
 * `adapter` accessor on `ActiveRecord::Base` (declared in
 * `packages/activerecord/src/base.ts`) are rewritten. Every other `.adapter`
 * site — unrelated classes that happen to expose an `adapter` field, object
 * literals, parameter/variable identifiers, JSDoc, comments — is left alone.
 *
 * Standalone tooling. This script does NOT apply changes unless `--apply` is
 * passed, and the migration plan
 * (docs/activerecord/connection-pooled-test-adapter-plan.md) sequences the
 * actual sweep PRs separately.
 *
 * Assignment targets (`Base.adapter = x`, `this.adapter = x`) are deliberately
 * NOT renamed: `connection` is a readonly accessor with no setter, so those
 * sites need the `establishConnection()` migration (scripts/d1-migrate.ts),
 * not a mechanical rename. They are reported under "skipped (assignment)".
 *
 * Usage:
 *   pnpm tsx scripts/codemods/base-adapter-to-connection.ts <path>... [--apply] [--report]
 *
 * Modes:
 *   --report / --dry-run  (default) classify sites, print a markdown summary
 *   --apply               write the renames back to disk in place (idempotent)
 *
 * Flags:
 *   --exclude <glob>      skip files matching the glob (repeatable)
 *
 * No `node:*` / `process.*` imports — file IO, args and path resolution all go
 * through the `typescript` package's `ts.sys` host.
 */
import ts from "typescript";

/** Classification of a single `.adapter` member-access site. */
export interface Site {
  kind: "rename" | "skip" | "manual";
  reason?: string;
  /** Offset range of the `adapter` name token (not the whole expression). */
  start: number;
  end: number;
  line: number;
}

export interface FileReport {
  fileName: string;
  total: number;
  rename: number;
  skip: number;
  manual: number;
  sites: Site[];
}

/**
 * True when `sym` is the deprecated `adapter` get/set accessor declared on a
 * class named `Base`. Subclass and `this`-based accesses resolve to this same
 * inherited symbol, so a single identity check covers static, subclass and
 * `this` forms. We require an *accessor* declaration so a plain `adapter:`
 * field on an unrelated class never matches.
 */
function isBaseAdapterSymbol(sym: ts.Symbol | undefined): boolean {
  if (!sym?.declarations) return false;
  return sym.declarations.some((d) => {
    if (!ts.isGetAccessor(d) && !ts.isSetAccessor(d)) return false;
    if (!ts.isIdentifier(d.name) || d.name.text !== "adapter") return false;
    const cls = d.parent;
    return ts.isClassLike(cls) && cls.name?.text === "Base";
  });
}

/** Is this property access the left-hand target of an `=` assignment? */
function isAssignmentTarget(node: ts.PropertyAccessExpression): boolean {
  const parent = node.parent;
  return (
    ts.isBinaryExpression(parent) &&
    parent.left === node &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );
}

/** Classify every `.adapter` member-access site in a source file. */
export function classifySites(sourceFile: ts.SourceFile, checker: ts.TypeChecker): Site[] {
  const sites: Site[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "adapter") {
      const start = node.name.getStart(sourceFile);
      const end = node.name.getEnd();
      const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
      const base: Pick<Site, "start" | "end" | "line"> = { start, end, line };
      const sym = checker.getSymbolAtLocation(node.name);
      if (isBaseAdapterSymbol(sym)) {
        if (isAssignmentTarget(node)) {
          sites.push({ kind: "skip", reason: "assignment (use establishConnection)", ...base });
        } else {
          sites.push({ kind: "rename", ...base });
        }
      } else if (!sym) {
        const lhs = checker.getTypeAtLocation(node.expression);
        if (lhs.flags & ts.TypeFlags.Any) {
          sites.push({ kind: "manual", reason: "LHS type unresolved (any)", ...base });
        } else {
          sites.push({ kind: "skip", reason: "LHS not Base", ...base });
        }
      } else {
        sites.push({ kind: "skip", reason: "LHS not Base", ...base });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return sites;
}

/** Apply `rename` sites to source text: `adapter` → `connection`. */
export function applyRenames(text: string, sites: Site[]): string {
  const renames = sites.filter((s) => s.kind === "rename").sort((a, b) => b.start - a.start);
  let out = text;
  for (const s of renames) {
    out = out.slice(0, s.start) + "connection" + out.slice(s.end);
  }
  return out;
}

function toReport(fileName: string, sites: Site[]): FileReport {
  return {
    fileName,
    total: sites.length,
    rename: sites.filter((s) => s.kind === "rename").length,
    skip: sites.filter((s) => s.kind === "skip").length,
    manual: sites.filter((s) => s.kind === "manual").length,
    sites,
  };
}

/**
 * In-memory analysis entry point used by tests: classify a set of virtual
 * files without touching disk. Returns one report per supplied file.
 */
export function analyzeSources(files: Record<string, string>): FileReport[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
    noEmit: true,
  };
  const fileNames = Object.keys(files);
  const host = ts.createCompilerHost(options, true);
  const baseGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, lang, onError, shouldCreate) => {
    if (name in files) {
      return ts.createSourceFile(name, files[name], lang, true);
    }
    return baseGetSourceFile(name, lang, onError, shouldCreate);
  };
  host.fileExists = (name) => name in files || ts.sys.fileExists(name);
  host.readFile = (name) => (name in files ? files[name] : ts.sys.readFile(name));
  const program = ts.createProgram(fileNames, options, host);
  const checker = program.getTypeChecker();
  return fileNames.map((name) => {
    const sf = program.getSourceFile(name)!;
    return toReport(name, classifySites(sf, checker));
  });
}

// ── CLI ──────────────────────────────────────────────────────────────────

function dirUrl(...segments: string[]): string {
  // import.meta.url → filesystem path without pulling in node:url.
  const here = new URL(".", import.meta.url).pathname;
  return ts.sys.resolvePath(here + segments.join("/"));
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\*\*|\*/g, (m) => (m === "**" ? ".*" : "[^/]*"));
  return new RegExp(pattern);
}

interface CliArgs {
  paths: string[];
  apply: boolean;
  excludes: RegExp[];
}

function parseArgs(argv: string[]): CliArgs {
  const paths: string[] = [];
  const excludes: RegExp[] = [];
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--report" || arg === "--dry-run") apply = false;
    else if (arg === "--exclude") excludes.push(globToRegExp(argv[++i] ?? ""));
    else if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    else paths.push(ts.sys.resolvePath(arg));
  }
  return { paths, apply, excludes };
}

function isUnderPaths(fileName: string, paths: string[]): boolean {
  return paths.some((p) => fileName === p || fileName.startsWith(p.endsWith("/") ? p : p + "/"));
}

function renderMarkdown(reports: FileReport[]): string {
  const lines: string[] = [];
  lines.push("# `Base.adapter` → `Base.connection` codemod report", "");
  lines.push("| File | total | rename | skip | manual |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  let total = 0,
    rename = 0,
    skip = 0,
    manual = 0;
  for (const r of reports.filter((r) => r.total > 0).sort((a, b) => b.rename - a.rename)) {
    lines.push(`| ${r.fileName} | ${r.total} | ${r.rename} | ${r.skip} | ${r.manual} |`);
    total += r.total;
    rename += r.rename;
    skip += r.skip;
    manual += r.manual;
  }
  lines.push(`| **total** | **${total}** | **${rename}** | **${skip}** | **${manual}** |`, "");
  const manualSites = reports.flatMap((r) =>
    r.sites
      .filter((s) => s.kind === "manual")
      .map((s) => `- ${r.fileName}:${s.line} — ${s.reason}`),
  );
  if (manualSites.length) {
    lines.push("## Needs manual review", "", ...manualSites, "");
  }
  return lines.join("\n");
}

function main(): void {
  const { paths, apply, excludes } = parseArgs(ts.sys.args);
  if (paths.length === 0) {
    ts.sys.write(
      "usage: base-adapter-to-connection.ts <path>... [--apply] [--report] [--exclude <glob>]\n",
    );
    ts.sys.exit(1);
    return;
  }

  const tsconfigPath = dirUrl("..", "..", "packages", "activerecord", "tsconfig.json");
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    ts.sys.write(
      ts.formatDiagnostics([configFile.error], {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => "\n",
      }),
    );
    ts.sys.exit(1);
    return;
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirUrl("..", "..", "packages", "activerecord"),
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();

  const targets = program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile)
    .filter((sf) => isUnderPaths(sf.fileName, paths))
    .filter((sf) => !excludes.some((re) => re.test(sf.fileName)));

  const reports: FileReport[] = [];
  let written = 0;
  for (const sf of targets) {
    const sites = classifySites(sf, checker);
    reports.push(toReport(sf.fileName, sites));
    if (apply && sites.some((s) => s.kind === "rename")) {
      const next = applyRenames(sf.getFullText(), sites);
      if (next !== sf.getFullText()) {
        ts.sys.writeFile(sf.fileName, next);
        written++;
      }
    }
  }

  if (apply) {
    for (const r of reports.filter((r) => r.rename > 0)) {
      ts.sys.write(`${r.fileName}: ${r.rename} renamed\n`);
    }
    ts.sys.write(
      `\n${written} file(s) modified, ${reports.reduce((n, r) => n + r.rename, 0)} site(s) renamed.\n`,
    );
  } else {
    ts.sys.write(renderMarkdown(reports) + "\n");
  }
}

// Entry-point guard. `process.argv[1]` is the only reliable "run directly vs
// imported" signal under tsx, and matches the established pattern across
// scripts/ (e.g. scripts/d1-migrate.ts). Arg parsing itself stays on ts.sys.
declare const process: { argv: string[] };
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
