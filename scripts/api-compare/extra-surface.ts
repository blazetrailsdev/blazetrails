#!/usr/bin/env npx tsx
/**
 * Surface TypeScript files whose public API has drifted *beyond* their Rails
 * counterpart — the inverse of `api:compare`.
 *
 * `api:compare` reports Rails methods missing in TS. This script reports TS
 * public methods/functions/getters/setters that don't correspond to any
 * Ruby method in the matched Rails file. It's a fact-finding audit so we
 * can prune toward Rails-faithful shape; it never modifies source.
 *
 * Algorithm, per Rails-mirroring package:
 *   1. For each Ruby file, resolve its expected TS file via `rubyFileToTs`.
 *   2. Collect Ruby public methods declared in (or `include`d into) the
 *      entities in that Ruby file. Map each to its TS-candidate name set
 *      via `rubyMethodToTs`. Union = the "allowed" TS name set.
 *   3. Collect public TS names declared in the matching TS file — each
 *      class/module's *own* methods (skipping inherited surface so the
 *      diff measures this file's drift, not its ancestor's) plus top-level
 *      `fileFunctions`. Filter out `internal: true` (covers `_`-prefixed,
 *      `@internal` JSDoc, `private`/`protected`, `#`-prefixed fields).
 *   4. Extra = TS names \ allowed names. Emit per-file, per-package, and
 *      top-N reports.
 *
 * Manifests are produced by `pnpm api:compare`; if they're missing the
 * script bails with a hint (same convention as `api:moves`).
 *
 * Usage:
 *   pnpm tsx scripts/api-compare/extra-surface.ts \
 *     [--package <name>] [--top <N>] [--json] [--exclude-glob <glob>]...
 *
 * Each extra is classified as **novel** (the candidate name appears nowhere
 * in Rails-land) or **moved** (Rails defines it, just in a different `.rb`).
 * Files are ranked by novel count primarily — barrel-style aggregators
 * (`connection-adapters.ts`) drop below smaller novel-heavy files like
 * `relation/finder-methods.ts`. `--novel-only` drops moved extras entirely.
 *
 * Flags:
 *   --package <name>      Restrict to one package (e.g. activerecord).
 *   --top <N>             Top-N most-divergent files (default 50).
 *   --json                Emit machine-readable JSON to stdout instead of
 *                         the human report.
 *   --exclude-glob <g>    Skip TS files matching <g> (substring match
 *                         against the TS file path). Repeatable. Useful
 *                         for known-intentional extensions like
 *                         `dx-tests/` or `defineSchema`-only modules.
 *   --novel-only          Drop moved-not-novel extras (filters barrel noise).
 *   --max-detail <N>      Cap names per file in detail listing (default 40).
 *   --help                Print this message.
 */

import * as fs from "fs";
import * as path from "path";
import type { ApiManifest, ClassInfo, MethodInfo } from "./types.js";
import { OUTPUT_DIR } from "./config.js";
import { rubyFileToTs, rubyMethodToTs } from "./conventions.js";
import { resolveModuleName } from "./compare.js";

/**
 * Track the FQN alongside the entity so namespace-scoped include resolution
 * (`resolveModuleName(short, fqn, …)`) picks the *enclosing* module —
 * e.g. `AbstractAdapter` including `"Quoting"` resolves to
 * `ConnectionAdapters::Quoting`, not the adapter-specific siblings.
 */
interface RubyEntity {
  fqn: string;
  info: ClassInfo;
}

/** Get-or-init helper: replaces the `(get() ?? set([]).get()!).push(v)` idiom. */
function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * An extra TS name is **moved** if a Ruby method somewhere in Rails-land
 * camelizes to it (just not in the matched file). It's **novel** when no
 * Ruby method anywhere produces it — that's the high-signal class:
 * helpers, accidental public surface, TS-only ergonomics. Barrel files
 * like `connection-adapters.ts` are mostly `moved`; small focused files'
 * extras are mostly `novel`.
 */
export type ExtraKind = "novel" | "moved";

export interface ExtraName {
  name: string;
  kind: ExtraKind;
}

interface ExtraFile {
  package: string;
  tsFile: string;
  rubyFile: string;
  extraCount: number;
  novelCount: number;
  movedCount: number;
  extras: ExtraName[];
}

interface PackageTotals {
  package: string;
  filesWithDrift: number;
  totalExtras: number;
  totalNovel: number;
  totalMoved: number;
  extraFiles: ExtraFile[];
}

interface Report {
  generatedAt: string;
  packages: PackageTotals[];
  topN: ExtraFile[];
}

const HELP = `extra-surface — TS files with public API exceeding their Rails counterpart

Usage:
  pnpm tsx scripts/api-compare/extra-surface.ts [options]

Options:
  --package <name>     Restrict to one package (e.g. activerecord)
  --top <N>            Top-N most-divergent files (default 50)
  --json               Emit JSON to stdout instead of the human report
  --exclude-glob <g>   Skip TS files containing substring <g> (repeatable)
  --novel-only         Only count/show extras that don't appear ANYWHERE
                       in the Rails source (filters out moved-not-novel
                       drift; rank order also flips to novel-first)
  --max-detail <N>     Per-file detail listing cap (default 40 names;
                       0 = unlimited)
  --help               This message

Requires: pnpm api:compare must have run first to produce
  scripts/api-compare/output/{rails-api.json,ts-api.json}.
`;

export interface CliArgs {
  filterPkg: string | null;
  topN: number;
  json: boolean;
  excludeGlobs: string[];
  novelOnly: boolean;
  maxDetail: number;
}

export function parseArgs(argv: string[]): CliArgs {
  let filterPkg: string | null = null;
  let topN = 50;
  let json = false;
  let novelOnly = false;
  let maxDetail = 40;
  const excludeGlobs: string[] = [];

  const requireValue = (flag: string, v: string | undefined): string => {
    if (!v || v.startsWith("--")) {
      console.error(`${flag} requires a value`);
      process.exit(1);
    }
    return v;
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(HELP);
      process.exit(0);
    } else if (a === "--package") {
      filterPkg = requireValue("--package", argv[++i]);
    } else if (a === "--top") {
      const n = Number(requireValue("--top", argv[++i]));
      if (!Number.isInteger(n) || n <= 0) {
        console.error("--top requires a positive integer");
        process.exit(1);
      }
      topN = n;
    } else if (a === "--max-detail") {
      const n = Number(requireValue("--max-detail", argv[++i]));
      if (!Number.isInteger(n) || n < 0) {
        console.error("--max-detail requires a non-negative integer");
        process.exit(1);
      }
      maxDetail = n;
    } else if (a === "--json") {
      json = true;
    } else if (a === "--novel-only") {
      novelOnly = true;
    } else if (a === "--exclude-glob") {
      excludeGlobs.push(requireValue("--exclude-glob", argv[++i]));
    } else {
      console.error(`Unknown flag: ${a}`);
      console.error(HELP);
      process.exit(1);
    }
  }
  return { filterPkg, topN, json, excludeGlobs, novelOnly, maxDetail };
}

/**
 * Collect public TS names declared *in this file's own entities* — no
 * inherited surface. Inherited names that the parent already defines are
 * not "drift" relative to Rails; they're the parent's problem (and Rails
 * inherits them too).
 */
function collectTsFileNames(
  file: string,
  classes: ClassInfo[],
  modules: ClassInfo[],
  fileFunctions: MethodInfo[] | undefined,
): Set<string> {
  const out = new Set<string>();
  const push = (m: MethodInfo): void => {
    if (m.internal === true) return;
    if (m.name.startsWith("_")) return;
    out.add(m.name);
  };
  for (const c of classes) {
    if (c.file !== file) continue;
    for (const m of c.instanceMethods) push(m);
    for (const m of c.classMethods) push(m);
  }
  for (const m of modules) {
    if (m.file !== file) continue;
    for (const im of m.instanceMethods) push(im);
    for (const cm of m.classMethods) push(cm);
  }
  for (const fn of fileFunctions ?? []) push(fn);
  return out;
}

/**
 * For one Ruby file's entities, compute the union of all TS candidate names
 * produced by `rubyMethodToTs`. Mirrors `compare.flattenIncludedMethodInfos`
 * mixin routing:
 *
 *   - `include M`: M's instance methods land on the host as instance methods.
 *     A nested `include N` inside M chains through (instance methods only).
 *     M's own `extend` chain does NOT propagate to the host — Ruby `extend`
 *     affects only the receiver's singleton class.
 *   - `extend M` (at host level): M's instance methods land as class methods.
 *
 *   - Module `classMethods` are kept here because the api-compare extractor
 *     folds nested `ClassMethods` submodules (the `ActiveSupport::Concern`
 *     idiom) into their parent module's `classMethods` before we see them.
 *     Excluding them would drop the most common Rails mixin pattern from
 *     the allowed-name set and inflate false-positive extras.
 *
 * `include` names are resolved via compare.ts's `resolveModuleName`, which
 * walks namespace prefixes — `AbstractAdapter` including `"Quoting"` maps
 * only to `ConnectionAdapters::Quoting`, never to PG/MySQL siblings of the
 * same short name. The flat-by-short-name lookup we used before pulled in
 * unrelated modules and silently inflated `allowed`.
 *
 * Cross-package or stdlib mixins are silently skipped — same as compare.ts.
 */
function collectAllowedNames(
  entities: RubyEntity[],
  rubyModules: Record<string, ClassInfo>,
  moduleFqnByShort: Map<string, string[]>,
): Set<string> {
  const allowed = new Set<string>();
  const visited = new Set<string>();

  const addMethods = (methods: MethodInfo[]): void => {
    for (const m of methods) {
      if (m.internal === true) continue;
      const candidates = rubyMethodToTs(m.name);
      if (!candidates) continue;
      for (const c of candidates) allowed.add(c);
    }
  };

  const walkMixin = (incName: string, contextFqn: string): void => {
    const fqns = resolveModuleName(incName, contextFqn, moduleFqnByShort);
    for (const fqn of fqns) {
      if (visited.has(fqn)) continue;
      visited.add(fqn);
      const mod = rubyModules[fqn];
      if (!mod) continue;
      addMethods(mod.instanceMethods);
      addMethods(mod.classMethods);
      // Only chain `include`s — a module's own `extend` doesn't propagate
      // to the host (Ruby singleton-class semantics).
      for (const inc of mod.includes ?? []) walkMixin(inc, fqn);
    }
  };

  for (const { fqn, info } of entities) {
    addMethods(info.instanceMethods);
    addMethods(info.classMethods);
    for (const inc of info.includes ?? []) walkMixin(inc, fqn);
    for (const ext of info.extends ?? []) walkMixin(ext, fqn);
  }
  return allowed;
}

/**
 * Build the global "all Ruby method candidate names anywhere in Rails-land"
 * set, used to classify each extra as novel (nowhere in Rails) vs moved
 * (somewhere in Rails, just not in the matched file).
 */
export function buildGlobalRubyCandidates(ruby: ApiManifest): Set<string> {
  const all = new Set<string>();
  for (const pkg of Object.values(ruby.packages)) {
    const entities = [...Object.values(pkg.classes), ...Object.values(pkg.modules)] as ClassInfo[];
    for (const e of entities) {
      for (const m of [...e.instanceMethods, ...e.classMethods]) {
        if (m.internal === true) continue;
        const candidates = rubyMethodToTs(m.name);
        if (!candidates) continue;
        for (const c of candidates) all.add(c);
      }
    }
  }
  return all;
}

function buildPackageReport(
  pkg: string,
  ruby: ApiManifest,
  ts: ApiManifest,
  excludeGlobs: string[],
  globalRubyCandidates: Set<string>,
  novelOnly: boolean,
): PackageTotals {
  const rubyPkg = ruby.packages[pkg];
  const tsPkg = ts.packages[pkg];
  const result: PackageTotals = {
    package: pkg,
    filesWithDrift: 0,
    totalExtras: 0,
    totalNovel: 0,
    totalMoved: 0,
    extraFiles: [],
  };
  if (!rubyPkg || !tsPkg) return result;

  const moduleFqnByShort = new Map<string, string[]>();
  for (const fqn of Object.keys(rubyPkg.modules)) {
    const short = fqn.split("::").pop();
    if (!short) continue;
    const list = moduleFqnByShort.get(short) ?? [];
    list.push(fqn);
    moduleFqnByShort.set(short, list);
  }

  const rubyFiles = new Map<string, RubyEntity[]>();
  for (const [fqn, info] of [
    ...Object.entries(rubyPkg.classes),
    ...Object.entries(rubyPkg.modules),
  ] as [string, ClassInfo][]) {
    if (!info.file) continue;
    pushTo(rubyFiles, info.file, { fqn, info });
  }

  const tsClassesByFile = new Map<string, ClassInfo[]>();
  const tsModulesByFile = new Map<string, ClassInfo[]>();
  for (const c of Object.values(tsPkg.classes) as ClassInfo[]) {
    if (!c.file) continue;
    pushTo(tsClassesByFile, c.file, c);
  }
  for (const m of Object.values(tsPkg.modules) as ClassInfo[]) {
    if (!m.file) continue;
    pushTo(tsModulesByFile, m.file, m);
  }
  const tsFileFunctions = tsPkg.fileFunctions ?? {};

  for (const [rubyFile, entities] of rubyFiles) {
    const expectedTs = rubyFileToTs(rubyFile, pkg);
    if (excludeGlobs.some((g) => expectedTs.includes(g))) continue;

    const classes = tsClassesByFile.get(expectedTs) ?? [];
    const modules = tsModulesByFile.get(expectedTs) ?? [];
    const fileFns = tsFileFunctions[expectedTs];
    if (classes.length === 0 && modules.length === 0 && !fileFns) continue;

    const tsNames = collectTsFileNames(expectedTs, classes, modules, fileFns);
    if (tsNames.size === 0) continue;

    const allowed = collectAllowedNames(
      entities,
      rubyPkg.modules as Record<string, ClassInfo>,
      moduleFqnByShort,
    );

    const extras: ExtraName[] = [];
    let novelCount = 0;
    let movedCount = 0;
    for (const name of tsNames) {
      if (allowed.has(name)) continue;
      const kind: ExtraKind = globalRubyCandidates.has(name) ? "moved" : "novel";
      if (novelOnly && kind !== "novel") continue;
      extras.push({ name, kind });
      if (kind === "novel") novelCount++;
      else movedCount++;
    }
    if (extras.length === 0) continue;

    // Sort novel before moved, then alphabetical — novel is the higher-signal
    // tier and surfaces first in per-file detail dumps.
    extras.sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "novel" ? -1 : 1,
    );
    result.extraFiles.push({
      package: pkg,
      tsFile: expectedTs,
      rubyFile,
      extraCount: extras.length,
      novelCount,
      movedCount,
      extras,
    });
    result.filesWithDrift++;
    result.totalExtras += extras.length;
    result.totalNovel += novelCount;
    result.totalMoved += movedCount;
  }

  // Rank order: novel-first when --novel-only is on (only novel exists),
  // and otherwise rank by novel count (high-signal) then total. Pure-moved
  // barrel files (588 extras, 0 novel) drop below smaller novel-heavy files.
  result.extraFiles.sort(
    (a, b) =>
      b.novelCount - a.novelCount ||
      b.extraCount - a.extraCount ||
      a.tsFile.localeCompare(b.tsFile),
  );
  return result;
}

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function colorCount(n: number, useColor: boolean): string {
  if (!useColor) return String(n);
  if (n >= 20) return `${RED}${BOLD}${n}${RESET}`;
  if (n >= 10) return `${RED}${n}${RESET}`;
  if (n >= 5) return `${YELLOW}${n}${RESET}`;
  return String(n);
}

function printHumanReport(report: Report, topN: number, maxDetail: number): void {
  const useColor = process.stdout.isTTY === true;

  console.log(`\n${BOLD}Extra TS surface vs Rails${RESET}  (the inverse of api:compare)`);
  console.log(
    `${DIM}Generated ${report.generatedAt}  |  novel = name not found anywhere in Rails;  moved = found, just in a different .rb${RESET}\n`,
  );

  console.log(`${BOLD}Per-package totals${RESET}`);
  console.log(
    `  ${"Package".padEnd(20)} ${"Files".padStart(7)} ${"Novel".padStart(7)} ${"Moved".padStart(7)} ${"Total".padStart(7)}`,
  );
  console.log(
    `  ${"-".repeat(20)} ${"-".repeat(7)} ${"-".repeat(7)} ${"-".repeat(7)} ${"-".repeat(7)}`,
  );
  for (const pkg of report.packages) {
    const novel = colorCount(pkg.totalNovel, useColor);
    const pad = useColor ? 16 : 7;
    console.log(
      `  ${pkg.package.padEnd(20)} ${String(pkg.filesWithDrift).padStart(7)} ${novel.padStart(pad)} ${String(pkg.totalMoved).padStart(7)} ${String(pkg.totalExtras).padStart(7)}`,
    );
  }

  console.log(
    `\n${BOLD}Top ${Math.min(topN, report.topN.length)} most-divergent files${RESET}  ${DIM}(ranked by novel count, then total)${RESET}`,
  );
  console.log(
    `  ${"#".padStart(3)}  ${"Novel".padStart(5)}  ${"Moved".padStart(5)}  ${"Package".padEnd(16)} ${"TS file".padEnd(60)}`,
  );
  console.log(
    `  ${"-".repeat(3)}  ${"-".repeat(5)}  ${"-".repeat(5)}  ${"-".repeat(16)} ${"-".repeat(60)}`,
  );
  for (let i = 0; i < Math.min(topN, report.topN.length); i++) {
    const f = report.topN[i];
    const c = colorCount(f.novelCount, useColor);
    const pad = useColor ? 14 : 5;
    console.log(
      `  ${String(i + 1).padStart(3)}  ${c.padStart(pad)}  ${String(f.movedCount).padStart(5)}  ${f.package.padEnd(16)} ${f.tsFile.padEnd(60)}`,
    );
  }

  console.log(
    `\n${BOLD}Per-file detail${RESET}  ${DIM}(novel-first; moved names dimmed; +N more elided when over --max-detail)${RESET}\n`,
  );
  for (const pkg of report.packages) {
    if (pkg.extraFiles.length === 0) continue;
    console.log(`${BOLD}${pkg.package}${RESET}`);
    for (const f of pkg.extraFiles) {
      const novelTag = useColor
        ? colorCount(f.novelCount, useColor) + " novel"
        : `${f.novelCount} novel`;
      console.log(`  ${f.tsFile} — ${novelTag}, ${f.movedCount} moved`);
      const shown = maxDetail > 0 ? f.extras.slice(0, maxDetail) : f.extras;
      const cols = 4;
      for (let i = 0; i < shown.length; i += cols) {
        const row = shown.slice(i, i + cols).map((e) => {
          const label = e.name.padEnd(24);
          return useColor && e.kind === "moved" ? `${DIM}${label}${RESET}` : label;
        });
        console.log(`    ${row.join(" ")}`);
      }
      const elided = f.extras.length - shown.length;
      if (elided > 0) console.log(`    ${DIM}… +${elided} more${RESET}`);
    }
    console.log();
  }
}

export function buildReport(
  ruby: ApiManifest,
  ts: ApiManifest,
  opts: {
    filterPkg: string | null;
    excludeGlobs: string[];
    novelOnly: boolean;
    topN: number;
  },
): Report {
  const globalRubyCandidates = buildGlobalRubyCandidates(ruby);

  const packages: PackageTotals[] = [];
  for (const pkg of Object.keys(ruby.packages)) {
    if (opts.filterPkg && pkg !== opts.filterPkg) continue;
    if (!ts.packages[pkg]) continue;
    packages.push(
      buildPackageReport(pkg, ruby, ts, opts.excludeGlobs, globalRubyCandidates, opts.novelOnly),
    );
  }
  packages.sort((a, b) => b.totalNovel - a.totalNovel || b.totalExtras - a.totalExtras);

  const allExtras: ExtraFile[] = packages.flatMap((p) => p.extraFiles);
  allExtras.sort(
    (a, b) =>
      b.novelCount - a.novelCount ||
      b.extraCount - a.extraCount ||
      a.tsFile.localeCompare(b.tsFile),
  );

  return {
    generatedAt: new Date().toISOString(),
    packages,
    topN: allExtras.slice(0, opts.topN),
  };
}

export function main(argv = process.argv.slice(2)): void {
  const args = parseArgs(argv);

  const rubyPath = path.join(OUTPUT_DIR, "rails-api.json");
  const tsPath = path.join(OUTPUT_DIR, "ts-api.json");
  if (!fs.existsSync(rubyPath) || !fs.existsSync(tsPath)) {
    console.error(
      `Missing ${path.basename(fs.existsSync(rubyPath) ? tsPath : rubyPath)}. Run \`pnpm api:compare\` first to generate the manifests.`,
    );
    process.exit(1);
  }
  const ruby: ApiManifest = JSON.parse(fs.readFileSync(rubyPath, "utf-8"));
  const ts: ApiManifest = JSON.parse(fs.readFileSync(tsPath, "utf-8"));

  const report = buildReport(ruby, ts, {
    filterPkg: args.filterPkg,
    excludeGlobs: args.excludeGlobs,
    novelOnly: args.novelOnly,
    topN: args.topN,
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printHumanReport(report, args.topN, args.maxDetail);
}

const invokedAsScript =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === "string" &&
  process.argv[1].endsWith("extra-surface.ts");
if (invokedAsScript) main();
