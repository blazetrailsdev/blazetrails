/**
 * Arel query translator: Ruby → TypeScript skeleton generator
 *
 * Usage (from repo root):
 *   tsx scripts/parity/translate/arel.ts [--fixture arel-XX] [--dry-run] [--force]
 *
 * Reads the `-- Query:` comment from each arel fixture's schema.sql,
 * applies the rule-based translation map from docs/query-parity-verification.md,
 * and writes query.rb + query.ts skeletons into the fixture directory.
 *
 * Run when adding new fixtures. Existing files are skipped unless --force.
 * Generated files are starting points — review and correct before committing.
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
    if (args[i] === "--fixture") {
      const val = args[++i];
      if (!val || val.startsWith("-")) {
        process.stderr.write("--fixture requires a fixture name (e.g. --fixture arel-06)\n");
        usage();
      }
      fixture = val;
    } else if (args[i] === "--dry-run") dryRun = true;
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

/**
 * Apply the Ruby→TypeScript translation rules from docs/query-parity-verification.md.
 * Returns [rbExpr, tsExpr] for the body of the query expression.
 * When the query is too complex for rule-based translation, returns a TODO comment.
 */
// Patterns in `-- Query:` annotations that can't be reliably auto-translated.
// Queries matching these get a TODO body rather than broken generated code.
const NON_TRANSLATABLE = [
  /\.\.\./, // truncated annotations: "posts.join(comments, OuterJoin)..."
  /^[A-Z].*\s+/, // prose descriptions: "Simple CTE: ...", "WITH users_top AS ..."
  /COUNT\(/, // raw SQL fragments
  /WITH\s/, // WITH clause prose
  /ORDER BY/, // raw SQL ORDER BY prose
  /~/, // bitwise NOT — operand boundary can't be determined safely with regex
  /;/, // multi-statement forms: "replies = comments.alias; comments.join(...)"
  /\bquoted\(/, // unresolved helper: quoted('%Y%m') not a standard Arel method
  /:\w+\s*,/, // symbol args that aren't table/col refs: project(:id, :title)
  /\/\./, // slash-separated variant lists: users[:age].sum/.average/.minimum
];

function isNonTranslatable(query: string): boolean {
  return NON_TRANSLATABLE.some((re) => re.test(query));
}

function translateQuery(
  query: string,
  tables: string[],
): { rb: string; ts: string; imports: string[] } {
  // Build table declaration lines
  const rbDecls = tables.map((t) => `${t} = Arel::Table.new(:${t})`).join("\n");
  const tsDecls = tables.map((t) => `const ${t} = new Table("${t}");`).join("\n");

  if (isNonTranslatable(query)) {
    return {
      rb: `${rbDecls}\n# TODO: translate — ${query}`,
      ts: `${tsDecls}\n// TODO: translate — ${query}`,
      imports: ["Table"],
    };
  }

  // Apply single-expression translations (all rules verified against packages/arel/src/)
  let tsExpr = query
    // tbl[:col] → tbl.get("col")
    .replace(/(\w+)\[:([\w_]+)\]/g, '$1.get("$2")')
    // tbl[Arel.star] → tbl.star
    .replace(/(\w+)\[Arel\.star\]/g, "$1.star")
    // Arel.star → star (standalone)
    .replace(/\bArel\.star\b/g, "star")
    // Arel.sql(...) → sql(...)
    .replace(/Arel\.sql\(/g, "sql(")
    // .not_eq → .notEq
    .replace(/\.not_eq\(/g, ".notEq(")
    // .not_in → .notIn
    .replace(/\.not_in\(/g, ".notIn(")
    // .not_in_any → .notInAny (attributes/attribute.ts:318)
    .replace(/\.not_in_any\(/g, ".notInAny(")
    // .is_distinct_from → .isDistinctFrom
    .replace(/\.is_distinct_from\(/g, ".isDistinctFrom(")
    // .does_not_match_regexp → .doesNotMatchRegexp
    .replace(/\.does_not_match_regexp\(/g, ".doesNotMatchRegexp(")
    // Ruby nil → JS null
    .replace(/\bnil\b/g, "null")
    // %w[...] → array literal
    .replace(
      /%w\[([^\]]+)\]/g,
      (_, words) =>
        "[" +
        words
          .trim()
          .split(/\s+/)
          .map((w: string) => `"${w}"`)
          .join(", ") +
        "]",
    )
    // Single quotes → double quotes for strings
    .replace(/'([^']+)'/g, '"$1"')
    // Arel::Table.new(:foo) → new Table("foo")
    .replace(/Arel::Table\.new\(:(\w+)\)/g, 'new Table("$1")')
    // Arel::Nodes::NamedFunction.new → new Nodes.NamedFunction
    .replace(/Arel::Nodes::NamedFunction\.new\(/g, "new Nodes.NamedFunction(")
    // Arel::Nodes::OuterJoin / bare OuterJoin → Nodes.OuterJoin
    .replace(/Arel::Nodes::OuterJoin/g, "Nodes.OuterJoin")
    .replace(/\bOuterJoin\b/g, "Nodes.OuterJoin")
    // Arel::Nodes::Window.new → new Nodes.Window()
    .replace(/Arel::Nodes::Window\.new/g, "new Nodes.Window()")
    // Arel::Nodes::As.new → new Nodes.As
    .replace(/Arel::Nodes::As\.new\(/g, "new Nodes.As(")
    // Arel::Nodes::Quoted.new → new Nodes.Quoted
    .replace(/Arel::Nodes::Quoted\.new\(/g, "new Nodes.Quoted(")
    // Property aggregates → method calls (table.ts / attribute.ts)
    .replace(/\.count\b(?!\()/g, ".count()")
    .replace(/\.sum\b(?!\()/g, ".sum()")
    .replace(/\.average\b(?!\()/g, ".average()")
    .replace(/\.maximum\b(?!\()/g, ".maximum()")
    .replace(/\.minimum\b(?!\()/g, ".minimum()")
    .replace(/\.distinct\b(?!\()/g, ".distinct()")
    .replace(/\.not\b(?!\()/g, ".not()")
    .replace(/\.desc\b(?!\()/g, ".desc()")
    .replace(/\.asc\b(?!\()/g, ".asc()");
  // (~ is caught by NON_TRANSLATABLE above; no rule needed here)
  // NOTE: Ruby infix arithmetic (+, -, *, /) cannot be reliably rewritten
  // to method chains (.add/.subtract/.multiply/.divide) with regex; those
  // fixtures are hand-translated in query.ts directly.

  // Determine needed imports
  const imports: string[] = ["Table"];
  if (tsExpr.includes("Nodes.") || tsExpr.includes("BitwiseNot")) imports.push("Nodes");
  if (tsExpr.includes("sql(")) imports.push("sql");
  if (/\bstar\b/.test(tsExpr) && !tsExpr.includes(".star")) imports.push("star");

  return {
    rb: `${rbDecls}\n${query}`,
    ts: `${tsDecls}\n${tsExpr};`,
    imports: [...new Set(imports)].sort(),
  };
}

function generateRuby(info: FixtureInfo): string {
  const { rb } = translateQuery(info.query, info.tables);
  return `# ${info.name}: ${info.query}\n${rb}\n`;
}

function generateTs(info: FixtureInfo): string {
  const { ts, imports } = translateQuery(info.query, info.tables);
  const importLine = `import { ${imports.join(", ")} } from "@blazetrails/arel";`;
  return `// ${info.name}: ${info.query}\n${importLine}\n${ts}\n`;
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

    // Skip if either file exists (not just both) — avoids clobbering hand edits.
    const rbExists = existsSync(rbPath);
    const tsExists = existsSync(tsPath);
    if (!force && (rbExists || tsExists)) {
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
    if (generated > 0) {
      process.stdout.write(
        "Review all generated files — rule-based translation is approximate for complex queries.\n",
      );
    }
  }
}

main();
