/**
 * Pure generator for trails ActiveRecord model classes from an
 * introspected schema. No I/O — takes a list of `IntrospectedTable`
 * objects and returns a TS module string.
 *
 * Consumed by the `trails-models-dump` CLI (src/bin/trails-models-dump.ts)
 * which handles DB connections, argument parsing, and file output. Keeping
 * the generator separate means it's unit-testable against fabricated
 * input without spinning up a database.
 *
 * Output shape follows the idiomatic trails model declaration in
 * dx-tests/declare-patterns.test-d.ts:38-46 — static-block declarations
 * rather than post-class Associations.*.call() wiring.
 */

import type { ForeignKeyDefinition } from "./connection-adapters/abstract/schema-definitions.js";
import { classify, pluralize, singularize, tableize, underscore } from "@blazetrails/activesupport";

/**
 * One table worth of introspection data, sufficient for codegen.
 * Callers will assemble this by running introspectTables +
 * introspectPrimaryKey + introspectColumns + introspectForeignKeys
 * from schema-introspection.ts.
 */
export interface IntrospectedTable {
  name: string;
  /**
   * Primary-key column name(s) in PK-position order, or null when the
   * table has no primary key (views). Tables with `null` are skipped
   * entirely by the generator.
   */
  primaryKey: string | string[] | null;
  foreignKeys: ForeignKeyDefinition[];
  /** Used for polymorphic + STI detection; empty list is fine. */
  columns: { name: string; type: string }[];
}

export interface GenerateModelsOptions {
  /**
   * Free-form provenance string included in the header comment
   * (e.g. "sqlite:blog.db"). Ignored when `noHeader` is true.
   */
  sourceHint?: string;
  /**
   * Stripped from table names before classify() so `blog_posts` with
   * `stripPrefix: "blog_"` yields `class Post`. `_tableName` on the
   * generated class still preserves the full original name.
   */
  stripPrefix?: string;
  stripSuffix?: string;
  /** Suppress the "GENERATED ..." header comment. */
  noHeader?: boolean;
  /** Injected for deterministic test snapshots. Defaults to `new Date()`. */
  now?: Date;
}

interface PlannedClass {
  name: string;
  tableName: string;
  primaryKey: string | string[] | null;
  /** Ordered belongsTo then hasMany, alphabetical within each group. */
  body: string[];
  /** Comments (TODO / NOTE / WARNING) prepended at the top of the static block. */
  leadingComments: string[];
}

const BUILTIN_IGNORE = new Set(["schema_migrations", "ar_internal_metadata"]);

/**
 * Generate a TS module containing one `export class X extends Base { ... }`
 * per introspected table, with `belongsTo` / `hasMany` inferred from FKs.
 */
export function generateModels(
  tables: IntrospectedTable[],
  opts: GenerateModelsOptions = {},
): string {
  const { stripPrefix, stripSuffix, noHeader, sourceHint } = opts;
  const now = opts.now ?? new Date();

  // Filter: skip built-in bookkeeping tables and tables with no PK (views).
  const skipped: Array<{ name: string; reason: string }> = [];
  const kept: IntrospectedTable[] = [];
  for (const t of tables) {
    if (BUILTIN_IGNORE.has(t.name)) continue;
    if (t.primaryKey === null) {
      skipped.push({ name: t.name, reason: "no primary key (likely a view)" });
      continue;
    }
    kept.push(t);
  }

  // Sort alphabetically for stable diffs.
  kept.sort((a, b) => a.name.localeCompare(b.name));

  // Build the class plan for each kept table. FKs from OTHER tables still
  // need to contribute hasMany() to THIS class, so we collect them in a
  // second pass after resolving names.
  const strip = (name: string): string => {
    let n = name;
    if (stripPrefix && n.startsWith(stripPrefix)) n = n.slice(stripPrefix.length);
    if (stripSuffix && n.endsWith(stripSuffix)) n = n.slice(0, -stripSuffix.length);
    return n;
  };

  const classNameForTable = (tableName: string): string => classify(strip(tableName));
  const classes = new Map<string, PlannedClass>();
  // Track collisions so we fail fast rather than emit two `export class X`
  // declarations (invalid TS). Two tables strip/classify to the same name
  // most commonly when --strip-prefix uncovers a second copy of an existing
  // table (e.g. `posts` + `blog_posts` both → `Post`).
  const nameToTable = new Map<string, string>();
  for (const t of kept) {
    const className = classNameForTable(t.name);
    const existing = nameToTable.get(className);
    if (existing !== undefined) {
      throw new Error(
        `trails-models-dump: class name collision: both "${existing}" and "${t.name}" would generate \`class ${className}\`. ` +
          `Adjust --strip-prefix/--strip-suffix, --ignore one of them, or rename a table.`,
      );
    }
    nameToTable.set(className, t.name);
    classes.set(t.name, {
      name: className,
      tableName: t.name,
      primaryKey: t.primaryKey,
      body: [],
      leadingComments: [],
    });
  }

  // Build belongs_to on the "from" side and collect has_many additions
  // for the "to" side. We iterate deterministically (sorted by fromTable,
  // then column) so output ordering is stable.
  interface PendingHasMany {
    toTable: string;
    name: string;
    opts: Record<string, string>;
  }
  const hasManyByTable = new Map<string, PendingHasMany[]>();

  for (const t of kept) {
    const fromCls = classes.get(t.name);
    if (!fromCls) continue;
    // Sort FKs by column for stable output.
    const fks = [...t.foreignKeys].sort((a, b) => a.column.localeCompare(b.column));
    for (const fk of fks) {
      // Composite FK: emit TODO comment, no association.
      if (fk.column.includes(",")) {
        fromCls.leadingComments.push(
          `// TODO composite FK ${fk.name}: ${fk.column} -> ${fk.toTable}.${fk.primaryKey}`,
        );
        continue;
      }
      // If the target table was filtered out, skip — no class to point at.
      const toCls = classes.get(fk.toTable);
      if (!toCls) continue;

      // belongsTo name: strip _id if present, otherwise fall back to the
      // underscored singular of the target table name — matching Rails'
      // convention so callers of Model.some_fk see the right association.
      const belongsToName =
        fk.column.endsWith("_id") && fk.column !== "_id"
          ? fk.column.slice(0, -3)
          : underscore(singularize(strip(fk.toTable)));

      // Rails convention for belongsTo(name) infers:
      //   foreignKey = "${name}_id"
      //   className  = classify(name)
      // Emit those options only when the actual FK column / target class
      // differs from what Rails would pick by default given `belongsToName`.
      const expectedForeignKey = `${underscore(belongsToName)}_id`;
      const conventionalClassName = classify(belongsToName);
      const belongsToOpts: Record<string, string> = {};
      if (fk.column !== expectedForeignKey) belongsToOpts.foreignKey = fk.column;
      if (toCls.name !== conventionalClassName) belongsToOpts.className = toCls.name;

      fromCls.body.push(formatAssoc("belongsTo", belongsToName, belongsToOpts));

      // hasMany on the target side. The association name is always the
      // source table's pluralised (stripped) form — no _id branch matters
      // here, unlike belongsTo. Self-referential case still lands here and
      // the user likely renames to "children"; generator emits the
      // table-derived default.
      const hasManyName = pluralize(strip(fk.fromTable));

      // Rails convention for hasMany(name) infers:
      //   foreignKey = "${underscore(singularize(current_class_name))}_id"
      //   className  = classify(singularize(name))
      // Generator compares against that so stripped-prefix cases
      // (e.g. blog_posts → Post) correctly emit `className`.
      const hmConventionalClassName = classify(singularize(hasManyName));
      const hmConventionalForeignKey = `${underscore(singularize(toCls.name))}_id`;
      const hmOpts: Record<string, string> = {};
      if (fk.column !== hmConventionalForeignKey) hmOpts.foreignKey = fk.column;
      if (fromCls.name !== hmConventionalClassName) hmOpts.className = fromCls.name;

      const pending = hasManyByTable.get(fk.toTable) ?? [];
      pending.push({ toTable: fk.toTable, name: hasManyName, opts: hmOpts });
      hasManyByTable.set(fk.toTable, pending);
    }
  }

  // Fold hasMany additions into each class, sorted by name.
  for (const [tableName, hms] of hasManyByTable) {
    const cls = classes.get(tableName);
    if (!cls) continue;
    hms.sort((a, b) => a.name.localeCompare(b.name));
    for (const hm of hms) {
      cls.body.push(formatAssoc("hasMany", hm.name, hm.opts));
    }
  }

  // Emit.
  const out: string[] = [];

  if (!noHeader) {
    const fromClause = sourceHint ? ` from ${sourceHint}` : "";
    out.push(
      `// GENERATED by trails-models-dump${fromClause} on ${now.toISOString()}.`,
      "// Do not edit by hand — re-run trails-models-dump to regenerate.",
    );
    const total = kept.length;
    const fkCount = kept.reduce((n, t) => n + t.foreignKeys.length, 0);
    const assocCount =
      2 *
      kept.reduce(
        (n, t) =>
          n +
          t.foreignKeys.filter((fk) => !fk.column.includes(",") && classes.has(fk.toTable)).length,
        0,
      );
    out.push(`//`);
    out.push(
      `// ${total} model${total === 1 ? "" : "s"}, ${assocCount} association${assocCount === 1 ? "" : "s"} from ${fkCount} foreign key${fkCount === 1 ? "" : "s"}.`,
    );
    for (const s of skipped) {
      out.push(`// SKIPPED ${s.name}: ${s.reason}`);
    }
    out.push("");
  }

  out.push(`import { Base } from "@blazetrails/activerecord";`, "");

  const emittedClasses = [...classes.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (let i = 0; i < emittedClasses.length; i++) {
    const cls = emittedClasses[i]!;
    out.push(`export class ${cls.name} extends Base {`);
    const staticLines: string[] = [];

    // Explicit _tableName when tableize round-trip doesn't recover the original.
    if (tableize(cls.name) !== cls.tableName) {
      staticLines.push(`    this._tableName = ${JSON.stringify(cls.tableName)};`);
    }
    // Explicit _primaryKey when non-default.
    if (Array.isArray(cls.primaryKey) && cls.primaryKey.length > 1) {
      staticLines.push(`    this._primaryKey = ${JSON.stringify(cls.primaryKey)};`);
    } else if (typeof cls.primaryKey === "string" && cls.primaryKey !== "id") {
      staticLines.push(`    this._primaryKey = ${JSON.stringify(cls.primaryKey)};`);
    } else if (
      Array.isArray(cls.primaryKey) &&
      cls.primaryKey.length === 1 &&
      cls.primaryKey[0] !== "id"
    ) {
      staticLines.push(`    this._primaryKey = ${JSON.stringify(cls.primaryKey[0])};`);
    }

    for (const c of cls.leadingComments) {
      staticLines.push(`    ${c}`);
    }
    for (const line of cls.body) {
      staticLines.push(`    ${line}`);
    }

    if (staticLines.length === 0) {
      out.push(`  static {}`);
    } else {
      out.push("  static {");
      out.push(...staticLines);
      out.push("  }");
    }
    out.push(`}`);
    if (i < emittedClasses.length - 1) out.push("");
  }

  return out.join("\n") + "\n";
}

function formatAssoc(
  kind: "belongsTo" | "hasMany",
  name: string,
  opts: Record<string, string>,
): string {
  const optKeys = Object.keys(opts).sort();
  if (optKeys.length === 0) return `this.${kind}(${JSON.stringify(name)});`;
  const optStr = optKeys.map((k) => `${k}: ${JSON.stringify(opts[k])}`).join(", ");
  return `this.${kind}(${JSON.stringify(name)}, { ${optStr} });`;
}
