/**
 * Builds eslint/rails-private-methods.json from
 * scripts/api-compare/output/rails-api.json.
 *
 * The manifest maps each TS source path (relative to repo root) to the
 * set of method/function names whose Rails counterpart is *exclusively*
 * private/protected on every class/module hosted in the same Ruby file.
 * The `blazetrails/rails-private-jsdoc` ESLint rule consumes it.
 *
 * Run after `pnpm tsx scripts/api-compare/extract-ruby-api.rb`:
 *   pnpm tsx scripts/build-rails-privates-manifest.ts
 */
import * as fs from "fs";
import * as path from "path";
import { rubyMethodToTs, rubyFileToTs } from "./api-compare/conventions.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, "..");

const PACKAGE_DIRS: Record<string, string> = {
  arel: "packages/arel/src",
  activemodel: "packages/activemodel/src",
  activerecord: "packages/activerecord/src",
  activesupport: "packages/activesupport/src",
  actiondispatch: "packages/rack/src",
  actioncontroller: "packages/actionpack/src/actioncontroller",
  actionview: "packages/actionpack/src/actionview",
  trailties: "packages/trailties/src",
};

const railsApi = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts/api-compare/output/rails-api.json"), "utf8"),
);

const manifest: Record<string, string[]> = {};

for (const [pkg, rubyPkg] of Object.entries<any>(railsApi.packages)) {
  const pkgDir = PACKAGE_DIRS[pkg];
  if (!pkgDir) continue;

  // rubyFile → name → "all-private" | "mixed"
  const fileVis = new Map<string, Map<string, "all-private" | "mixed">>();
  const note = (file: string, name: string, vis: string) => {
    let m = fileVis.get(file);
    if (!m) {
      m = new Map();
      fileVis.set(file, m);
    }
    const isPriv = vis !== "public";
    const prev = m.get(name);
    if (prev === undefined) m.set(name, isPriv ? "all-private" : "mixed");
    else if (prev === "all-private" && !isPriv) m.set(name, "mixed");
  };
  const collect = (entities: Record<string, any>) => {
    for (const ent of Object.values(entities)) {
      if (!ent.file) continue;
      for (const m of ent.instanceMethods ?? []) note(ent.file, m.name, m.visibility);
      for (const m of ent.classMethods ?? []) note(ent.file, m.name, m.visibility);
    }
  };
  collect(rubyPkg.classes ?? {});
  collect(rubyPkg.modules ?? {});

  for (const [rubyFile, names] of fileVis) {
    const tsRel = path.join(pkgDir, rubyFileToTs(rubyFile));
    const tsNames = new Set<string>();
    for (const [ruby, status] of names) {
      if (status !== "all-private") continue;
      for (const c of rubyMethodToTs(ruby) ?? []) tsNames.add(c);
    }
    if (tsNames.size === 0) continue;
    const existing = manifest[tsRel] ?? [];
    manifest[tsRel] = [...new Set([...existing, ...tsNames])].sort();
  }
}

const sortedKeys = Object.keys(manifest).sort();
const sorted: Record<string, string[]> = {};
for (const k of sortedKeys) sorted[k] = manifest[k];

const out = path.join(ROOT, "eslint/rails-private-methods.json");
fs.writeFileSync(out, JSON.stringify(sorted, null, 2) + "\n");
console.log(
  `Wrote ${out} — ${sortedKeys.length} files, ${Object.values(sorted).reduce(
    (n, a) => n + a.length,
    0,
  )} method names`,
);
