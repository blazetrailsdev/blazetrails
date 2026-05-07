#!/usr/bin/env npx tsx
/**
 * normalize-skips.ts
 *
 * Walks all *.test.ts files under packages/activerecord/src/ and inserts the
 * structured skip annotation into every bare it.skip / xit / test.skip /
 * describe.skip call that does not already have a BLOCKED: comment.
 *
 * Annotation format (from docs/test-compare-100-plan.md):
 *
 *   it.skip("rails-test-name", () => {
 *     // BLOCKED: <category> — <reason>
 *     // ROOT-CAUSE: <file>#<symbol> not implementing <behavior>
 *     // SCOPE: ~N LOC fix in <file>; affects ~M other tests across <dirs>
 *   });
 *
 * Usage:
 *   npx tsx scripts/test-compare/normalize-skips.ts [--dry-run]
 *
 * With --dry-run: prints a summary of what would change without touching files.
 * Without --dry-run: applies changes in place.
 */

import * as fs from "fs";
import * as path from "path";
import { globSync } from "tinyglobby";

const ROOT_DIR = path.resolve(__dirname, "../..");
const AR_SRC = path.join(ROOT_DIR, "packages/activerecord/src");

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Categorization table
// Maps a relative file path (from AR_SRC) to annotation lines.
// More specific patterns must come first.
// ---------------------------------------------------------------------------

interface Annotation {
  blocked: string;
  rootCause: string;
  scope: string;
}

function categorize(relPath: string, describeName: string, testName: string): Annotation {
  const p = relPath.replace(/\\/g, "/");

  // --- PostgreSQL adapter ---
  if (p.startsWith("adapters/postgresql/")) {
    const file = path.basename(p, ".test.ts");
    if (p.includes("rake") || p.includes("dbconsole")) {
      return {
        blocked: "rake — Rake/dbconsole shell-out cannot run in Node.js",
        rootCause: `${file}.ts#exec not translatable to Node.js`,
        scope: "~0 LOC fix; permanent skip-list.ts candidate",
      };
    }
    return {
      blocked: `adapter-pg — PostgreSQL-specific adapter gap in ${file}`,
      rootCause: `adapters/postgresql/${file}.ts missing or incomplete Rails parity`,
      scope: `~50–200 LOC fix in adapters/postgresql/${file}.ts; affects ~10–47 tests in ${file}.test.ts`,
    };
  }

  // --- MySQL adapter (mysql2 / trilogy / abstract-mysql) ---
  if (
    p.startsWith("adapters/mysql2/") ||
    p.startsWith("adapters/trilogy/") ||
    p.startsWith("adapters/abstract-mysql-adapter/")
  ) {
    const file = path.basename(p, ".test.ts");
    if (p.includes("rake") || p.includes("dbconsole")) {
      return {
        blocked: "rake — Rake/dbconsole shell-out cannot run in Node.js",
        rootCause: `${file}.ts#exec not translatable to Node.js`,
        scope: "~0 LOC fix; permanent skip-list.ts candidate",
      };
    }
    return {
      blocked: `adapter-mysql — MySQL-specific adapter gap in ${file}`,
      rootCause: `adapters/mysql2/${file}.ts or abstract-mysql-adapter/${file}.ts missing Rails parity`,
      scope: `~50–150 LOC fix in adapters/mysql2/${file}.ts; affects ~10–26 tests in ${file}.test.ts`,
    };
  }

  // --- SQLite adapter ---
  if (p.startsWith("adapters/sqlite3/") || p.startsWith("adapters/sqlite/")) {
    const file = path.basename(p, ".test.ts");
    if (p.includes("rake") || p.includes("dbconsole")) {
      return {
        blocked: "rake — Rake/dbconsole shell-out cannot run in Node.js",
        rootCause: `${file}.ts#exec not translatable to Node.js`,
        scope: "~0 LOC fix; permanent skip-list.ts candidate",
      };
    }
    return {
      blocked: `adapter-sqlite — SQLite-specific adapter gap in ${file}`,
      rootCause: `adapters/sqlite3/${file}.ts missing Rails parity`,
      scope: `~30–100 LOC fix in adapters/sqlite3/${file}.ts; affects ~1–17 tests in ${file}.test.ts`,
    };
  }

  // --- Associations cluster ---
  if (
    p.startsWith("associations/") ||
    p === "associations.test.ts" ||
    p === "autosave-association.test.ts" ||
    p === "autosave.test.ts" ||
    p === "nested-attributes.test.ts"
  ) {
    const file = path.basename(p, ".test.ts");
    const what = p.includes("has-and-belongs")
      ? "habtm"
      : p.includes("has-many-through")
        ? "has-many-through"
        : p.includes("has-one-through")
          ? "has-one-through"
          : p.includes("has-one")
            ? "has-one"
            : p.includes("has-many")
              ? "has-many"
              : p.includes("belongs-to")
                ? "belongs-to"
                : p.includes("inverse")
                  ? "inverse-of"
                  : p.includes("eager")
                    ? "eager-loading"
                    : p.includes("join-model")
                      ? "join-model"
                      : p.includes("autosave")
                        ? "autosave"
                        : p.includes("nested")
                          ? "nested-attributes"
                          : "collection/singular";
    return {
      blocked: `associations — ${what} feature gap`,
      rootCause: `associations/${file}.ts or preloader.ts missing ${what} semantics`,
      scope: `~50–200 LOC fix in associations/ or preloader.ts; affects ~10–79 tests in ${file}.test.ts`,
    };
  }

  // --- Relation / query cluster ---
  if (
    p.startsWith("relation/") ||
    p.startsWith("scoping/") ||
    p === "calculations.test.ts" ||
    p === "aggregations.test.ts" ||
    p === "batches.test.ts" ||
    p === "bind-parameter.test.ts" ||
    p === "readonly.test.ts" ||
    p === "strict-loading.test.ts" ||
    p === "adapter-prevent-writes.test.ts" ||
    p === "base-prevent-writes.test.ts" ||
    p === "view.test.ts"
  ) {
    const file = path.basename(p, ".test.ts");
    if (p.includes("load-async")) {
      return {
        blocked: "load-async — FutureResult / async query infrastructure not implemented",
        rootCause: "future-result.ts#FutureResult not implemented; Relation#loadAsync missing",
        scope:
          "~150 LOC in future-result.ts + relation.ts; affects ~28–31 tests in load-async.test.ts",
      };
    }
    if (p.includes("where-chain")) {
      return {
        blocked: "relation — WhereChain feature gap (not/and/or chaining)",
        rootCause: "relation/where-chain.ts#WhereChain missing or incomplete Rails parity",
        scope: "~50 LOC in relation/where-chain.ts; affects ~27 tests in where-chain.test.ts",
      };
    }
    if (p.includes("where")) {
      return {
        blocked: "relation — WHERE clause feature gap (polymorphic / association / composite-PK)",
        rootCause: "relation/where-clause.ts#whereClauseFor missing association / polymorphic join",
        scope:
          "~100 LOC in relation/where-clause.ts + associations/; affects ~39 tests in where.test.ts",
      };
    }
    if (p.includes("scoping")) {
      return {
        blocked: "relation — relation scoping feature gap",
        rootCause: "relation/scoping.ts#scopeFor or Relation#scoped missing Rails parity",
        scope: "~50 LOC in relation/scoping.ts; affects ~28 tests in relation-scoping.test.ts",
      };
    }
    if (p.includes("strict-loading")) {
      return {
        blocked: "relation — StrictLoadingViolation not wired into association loading",
        rootCause: "strict-loading.ts#checkStrictLoading not called from association loading path",
        scope:
          "~30 LOC in strict-loading.ts + associations/association.ts; affects ~41 tests in strict-loading.test.ts",
      };
    }
    if (p.includes("calculations") || p.includes("aggregations")) {
      return {
        blocked: "relation — calculation / aggregation gap",
        rootCause:
          "relation/calculations.ts#calculate or Relation#sum/avg/min/max missing Rails parity",
        scope:
          "~50 LOC in relation/calculations.ts; affects ~21 tests in calculations/aggregations.test.ts",
      };
    }
    if (p.includes("batches")) {
      return {
        blocked: "relation — batch enumeration gap (inBatchesOf / findEach cursor)",
        rootCause:
          "relation/batches.ts#inBatchesOf or findEachWithOrder missing composite-PK support",
        scope: "~50 LOC in relation/batches.ts; affects ~13 tests in batches.test.ts",
      };
    }
    if (p.includes("view")) {
      return {
        blocked: "schema — database view DDL not implemented (createView / dropView)",
        rootCause: "connection-adapters/abstract/schema-statements.ts#createView not implemented",
        scope: "~50 LOC in abstract/schema-statements.ts; affects ~21 tests in view.test.ts",
      };
    }
    if (p.includes("prevent-writes")) {
      return {
        blocked: "relation — preventingWrites guard not wired into all query paths",
        rootCause:
          "relation.ts or abstract-adapter.ts#executeMutation missing preventingWrites check for some query types",
        scope: "~20 LOC in relation.ts; affects ~5–8 tests in base-prevent-writes.test.ts",
      };
    }
    return {
      blocked: `relation — Relation API gap in ${file}`,
      rootCause: `relation/${file}.ts or relation.ts missing Rails parity for this query feature`,
      scope: `~30–100 LOC fix in relation/; affects ~10–39 tests in ${file}.test.ts`,
    };
  }

  // --- Load-async (top-level) ---
  if (p === "asynchronous-queries.test.ts" || p.includes("load-async")) {
    return {
      blocked: "load-async — FutureResult / async query infrastructure not implemented",
      rootCause: "future-result.ts#FutureResult not implemented; Relation#loadAsync missing",
      scope: "~150 LOC in future-result.ts + relation.ts; affects ~31 tests in load-async.test.ts",
    };
  }

  // --- Query cache ---
  if (p === "query-cache.test.ts" || p.includes("query-cache")) {
    return {
      blocked: "query-cache — query cache not fully implemented",
      rootCause: "connection-adapters/abstract/query-cache.ts#cacheQuery not fully wired",
      scope: "~50 LOC in abstract/query-cache.ts; affects ~28 tests in query-cache.test.ts",
    };
  }

  // --- Encryption ---
  if (p.startsWith("encryption/") || p.includes("encrypt")) {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: `encryption — encryption subsystem gap in ${file}`,
      rootCause: `encryption/${file}.ts missing Rails parity`,
      scope: `~50–200 LOC fix in encryption/${file}.ts; affects ~6–28 tests in ${file}.test.ts`,
    };
  }

  // --- Schema / DDL ---
  if (
    p === "schema-dumper.test.ts" ||
    p === "active-record-schema.test.ts" ||
    p === "column-definition.test.ts" ||
    p === "column-alias.test.ts" ||
    p === "comment.test.ts" ||
    p === "reserved-word.test.ts" ||
    p.includes("schema-cache")
  ) {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: `schema — schema introspection / dumper gap in ${file}`,
      rootCause: `${file}.ts or abstract/schema-statements.ts missing Rails parity`,
      scope: `~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in ${file}.test.ts`,
    };
  }

  // --- Migration ---
  if (
    p === "migration.test.ts" ||
    p === "hot-compatibility.test.ts" ||
    p === "invertible-migration.test.ts" ||
    p.startsWith("migration/")
  ) {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: `migration — migration runner gap in ${file}`,
      rootCause: `migration.ts#${describeName || "Migration"} not fully implementing Rails migration semantics`,
      scope: `~50–150 LOC fix in migration.ts; affects ~4–30 tests in ${file}.test.ts`,
    };
  }

  // --- Transactions / locking ---
  if (
    p === "transactions.test.ts" ||
    p === "transaction-callbacks.test.ts" ||
    p === "locking.test.ts" ||
    p === "optimistic-locking.test.ts" ||
    p === "pessimistic-locking.test.ts"
  ) {
    const file = path.basename(p, ".test.ts");
    if (p.includes("locking")) {
      return {
        blocked: "transactions — locking feature gap",
        rootCause: `${file}.ts#lockFor or withLock not fully implementing Rails locking semantics`,
        scope: `~50 LOC fix in ${file}.ts; affects ~7–15 tests in ${file}.test.ts`,
      };
    }
    return {
      blocked: "transactions — transaction / savepoint / isolation gap",
      rootCause: "transactions.ts#withTransaction or savepoint semantics not fully implemented",
      scope: `~50 LOC fix in transactions.ts; affects ~15 tests in ${file}.test.ts`,
    };
  }

  if (p === "transaction-isolation.test.ts") {
    return {
      blocked: "GVL — Ruby thread isolation semantics, no Node.js equivalent",
      rootCause:
        "Node.js has no Thread.new / GVL concept; transaction isolation tests depend on concurrent threads",
      scope: "~0 LOC fix; permanent skip-list.ts candidate",
    };
  }

  // --- Connection pool / handler ---
  if (
    p === "connection-pool.test.ts" ||
    p === "connection-handling.test.ts" ||
    p === "connection-management.test.ts" ||
    p === "active-record.test.ts" ||
    p === "multiple-db.test.ts" ||
    p === "multiple-db-auto-switch.test.ts" ||
    p.startsWith("connection-adapters/") ||
    p.includes("connection-handler") ||
    p.includes("sharding") ||
    p.includes("shard")
  ) {
    const file = path.basename(p, ".test.ts");
    if (p.includes("management")) {
      return {
        blocked: "connection-pool — ConnectionManagement rack middleware not implemented",
        rootCause: "connection-management.ts#ConnectionManagement middleware not implemented",
        scope: "~50 LOC in connection-management.ts; affects ~11 tests",
      };
    }
    if (p.includes("sharding") || p.includes("shard")) {
      return {
        blocked: "connection-pool — sharding / shard-selector not fully implemented",
        rootCause: "connection-adapters/connection-handler.ts#connectingToShard not implemented",
        scope: "~100 LOC in connection-handler.ts; affects ~19–26 tests in sharding files",
      };
    }
    if (p.includes("multi-db") || p.includes("multiple")) {
      return {
        blocked: "connection-pool — multi-database handler / switching not fully implemented",
        rootCause:
          "connection-adapters/connection-handler.ts#connectedTo for multi-DB not fully implemented",
        scope: "~100 LOC in connection-handler.ts; affects ~11–21 tests in multiple-db files",
      };
    }
    return {
      blocked: `connection-pool — connection pool / handler gap in ${file}`,
      rootCause: `connection-pool.ts or connection-handler.ts missing Rails parity for ${describeName || "pool lifecycle"}`,
      scope: `~50–100 LOC fix in connection-pool.ts; affects ~10–24 tests in ${file}.test.ts`,
    };
  }

  // --- Reflection ---
  if (p === "reflection.test.ts") {
    return {
      blocked: "associations — reflection feature gap (macros / options inspection)",
      rootCause: "reflection.ts#AggregateReflection or ThroughReflection missing Rails parity",
      scope: "~50 LOC in reflection.ts; affects ~31 tests in reflection.test.ts",
    };
  }

  // --- Type / type-map ---
  if (p.startsWith("type/") || p === "attributes.test.ts" || p === "bigint-roundtrip.test.ts") {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: `type — type cast/serialize/deserialize gap in ${file}`,
      rootCause: `type/${file}.ts or attribute-types.ts missing Rails parity`,
      scope: `~20–100 LOC fix in type/; affects ~2–18 tests in ${file}.test.ts`,
    };
  }

  if (
    p === "date-time-precision.test.ts" ||
    p === "date-time.test.ts" ||
    p === "date.test.ts" ||
    p === "time-precision.test.ts"
  ) {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: `type — date/time precision type gap in ${file}`,
      rootCause:
        "type/date-time.ts or type/time.ts#precision not fully matching Rails cast/serialize behavior",
      scope: `~30 LOC fix in type/date-time.ts or type/time.ts; affects ~8–18 tests in ${file}.test.ts`,
    };
  }

  // --- Serialization ---
  if (
    p === "binary.test.ts" ||
    p === "serialization.test.ts" ||
    p === "serialized-attribute.test.ts" ||
    p === "yaml-serialization.test.ts"
  ) {
    const file = path.basename(p, ".test.ts");
    if (p === "binary.test.ts" || p === "yaml-serialization.test.ts") {
      return {
        blocked: "serialization — Ruby encoding / YAML round-trip, no Node.js equivalent",
        rootCause: "Node.js has no Encoding::ASCII_8BIT or Ruby Marshal/YAML object round-trip",
        scope: "~0 LOC fix; permanent skip-list.ts candidate",
      };
    }
    return {
      blocked: `serialization — serialized attribute / YAML gap in ${file}`,
      rootCause:
        "serialized-attribute.ts#castForDatabase or YAMLCodec not fully implementing Rails parity",
      scope: `~30 LOC fix in serialized-attribute.ts; affects ~16 tests in ${file}.test.ts`,
    };
  }

  // --- Validation ---
  if (p.startsWith("validations/") || p.includes("validation") || p.includes("i18n")) {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: `validation — validator behavior gap in ${file}`,
      rootCause: `validations/${file}.ts or i18n/translation.ts missing Rails parity`,
      scope: `~30–100 LOC fix in validations/; affects ~4–11 tests in ${file}.test.ts`,
    };
  }

  // --- Tasks ---
  if (p.startsWith("tasks/")) {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: `unknown — database task implementation gap in ${file}`,
      rootCause: `tasks/${file}.ts missing Rails parity for task lifecycle`,
      scope: `~30–100 LOC fix in tasks/${file}.ts; affects ~26 tests in ${file}.test.ts`,
    };
  }

  // --- Database configurations ---
  if (p.startsWith("database-configurations/")) {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: `unknown — database configuration feature gap in ${file}`,
      rootCause: "database-configurations.ts or connection-url-resolver.ts missing Rails parity",
      scope: `~30–50 LOC fix in database-configurations.ts; affects ~5–34 tests in ${file}.test.ts`,
    };
  }

  // --- STI / inheritance ---
  if (p === "inheritance.test.ts" || p.includes("sti") || p.includes("delegated-type")) {
    const file = path.basename(p, ".test.ts");
    return {
      blocked: "STI — single-table inheritance routing gap",
      rootCause: "inheritance.ts#instantiateWithCtiMixin or findSubclass not fully wired",
      scope: `~50 LOC fix in inheritance.ts; affects ~8–15 tests in ${file}.test.ts`,
    };
  }

  // --- Insert-all ---
  if (p === "insert-all.test.ts") {
    return {
      blocked: "unknown — insert-all test setup gap; impl at 100% (#1255)",
      rootCause: "insert-all.test.ts test model/fixture setup incomplete for some edge cases",
      scope: "~20 LOC in insert-all.test.ts test setup; affects ~64 tests",
    };
  }

  // --- Adapter (abstract) ---
  if (p === "adapter.test.ts") {
    return {
      blocked: "unknown — abstract adapter introspection/execution gap",
      rootCause:
        "connection-adapters/abstract/abstract-adapter.ts missing Rails parity for this feature",
      scope: "~50 LOC in abstract-adapter.ts; affects ~70 tests in adapter.test.ts",
    };
  }

  // --- Base test ---
  if (p === "base.test.ts") {
    return {
      blocked: "unknown — base AR feature gap (fixture / connected_to / STI / other)",
      rootCause: "base.ts or core.ts missing Rails parity for this test's feature",
      scope: "~30–100 LOC fix in base.ts; affects ~36 tests in base.test.ts",
    };
  }

  // --- Schema dumper ---
  if (p === "schema-dumper.test.ts") {
    return {
      blocked: "schema — SchemaDumper not fully implemented",
      rootCause: "schema-dumper.ts#SchemaDumper#table or #header not fully implemented",
      scope: "~200 LOC fix in schema-dumper.ts; affects ~43 tests in schema-dumper.test.ts",
    };
  }

  // --- GVL-adjacent files ---
  if (p === "reaper.test.ts") {
    return {
      blocked: "GVL — Thread.kill / reaper semantics, no Node.js equivalent",
      rootCause: "Node.js has no Thread.kill; connection reaper depends on Ruby thread lifecycle",
      scope: "~0 LOC fix; permanent skip-list.ts candidate",
    };
  }

  // --- Fallback ---
  const file = path.basename(p, ".test.ts");
  return {
    blocked: `unknown — ${file} feature gap; needs human triage`,
    rootCause: `${file}.ts missing Rails parity; exact symbol unclear without running the test`,
    scope: `~30–100 LOC fix in ${file}.ts; affects ~1–10 tests in ${file}.test.ts`,
  };
}

// ---------------------------------------------------------------------------
// Text transformation: insert annotation into a skip call body
// ---------------------------------------------------------------------------

/**
 * Find the matching closing brace given a position just AFTER the opening `{`.
 * Returns the index of the matching `}`.
 */
function findMatchingClose(src: string, openPos: number): number {
  let depth = 1;
  let i = openPos;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === "/" && next === "/") {
        inLineComment = true;
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingle = true;
        i++;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        i++;
        continue;
      }
      if (ch === "`") {
        inTemplate = true;
        i++;
        continue;
      }
      if (ch === "{") {
        depth++;
        i++;
        continue;
      }
      if (ch === "}") {
        depth--;
        if (depth === 0) return i;
        i++;
        continue;
      }
    } else if (inSingle) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
    } else if (inDouble) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
    } else if (inTemplate) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") inTemplate = false;
    }
    i++;
  }
  return -1;
}

/**
 * Given the source of a single test file, return a modified version with
 * BLOCKED: annotations inserted into every un-annotated skip call.
 *
 * Returns null if no changes were needed.
 */
function annotateFile(src: string, relPath: string): string | null {
  // Regex to find skip call openers (handles it.skip / xit / test.skip / describe.skip).
  // Captures up to and including the `{` of the callback body.
  const SKIP_OPEN =
    /\b(?:it\.skip|xit|test\.skip|describe\.skip)\s*\(\s*(?:"[^"]*"|'[^']*'|`[^`]*`)\s*,\s*\(\s*\)\s*=>\s*\{/g;

  let result = src;
  let offset = 0; // cumulative offset from insertions

  // We must process left-to-right, so collect all matches first on the original source.
  const matches: Array<{ index: number; match: string }> = [];
  let m: RegExpExecArray | null;
  SKIP_OPEN.lastIndex = 0;
  while ((m = SKIP_OPEN.exec(src)) !== null) {
    matches.push({ index: m.index, match: m[0] });
  }

  for (const { index, match } of matches) {
    // Skip matches inside line comments (// it.skip...)
    const lineStart0 = src.lastIndexOf("\n", index) + 1;
    const linePrefix = src.slice(lineStart0, index);
    if (/\/\//.test(linePrefix)) continue;

    const adjIndex = index + offset;
    const adjMatchEnd = adjIndex + match.length; // position just after the `{`
    const closePos = findMatchingClose(result, adjMatchEnd);
    if (closePos === -1) continue;

    const body = result.slice(adjMatchEnd, closePos);

    // Skip if already annotated
    if (/BLOCKED:/.test(body)) continue;

    // Determine indentation of the skip call line
    const lineStart = result.lastIndexOf("\n", adjIndex) + 1;
    const lineIndent = result.slice(lineStart, adjIndex).match(/^(\s*)/)?.[1] ?? "";
    const innerIndent = lineIndent + "  ";

    // Determine describe name for categorization (heuristic: scan backward for describe(
    const contextWindow = src.slice(Math.max(0, index - 2000), index);
    const describeMatch = [...contextWindow.matchAll(/describe\s*\(\s*["'`]([^"'`]+)["'`]/g)].pop();
    const describeName = describeMatch?.[1] ?? "";

    // Test name from the match
    const testNameMatch = match.match(/["'`]([^"'`]+)["'`]/);
    const testName = testNameMatch?.[1] ?? "";

    const ann = categorize(relPath, describeName, testName);

    // If body is empty (only whitespace), expand to multiline.
    // If body already has content, prepend the annotation.
    let insertion: string;
    if (/^\s*$/.test(body)) {
      insertion = `\n${innerIndent}// BLOCKED: ${ann.blocked}\n${innerIndent}// ROOT-CAUSE: ${ann.rootCause}\n${innerIndent}// SCOPE: ${ann.scope}\n${lineIndent}`;
    } else {
      // Body has content — insert annotation at start of body (after the `{`)
      insertion = `\n${innerIndent}// BLOCKED: ${ann.blocked}\n${innerIndent}// ROOT-CAUSE: ${ann.rootCause}\n${innerIndent}// SCOPE: ${ann.scope}`;
    }

    const insertAt = adjMatchEnd;
    result = result.slice(0, insertAt) + insertion + result.slice(insertAt);
    offset += insertion.length;
  }

  return result === src ? null : result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const files = globSync("**/*.test.ts", {
  cwd: AR_SRC,
  absolute: true,
}).filter((f) => !f.includes("/dx-tests/") && !f.includes("/virtualized-dx-tests/"));

let totalFiles = 0;
let totalChanged = 0;
let totalSkips = 0;

const categoryCount: Record<string, number> = {};

for (const absPath of files) {
  const relPath = path.relative(AR_SRC, absPath);
  const src = fs.readFileSync(absPath, "utf-8");

  const modified = annotateFile(src, relPath);

  if (modified !== null) {
    totalFiles++;
    // count inserted BLOCKED: occurrences
    const before = (src.match(/BLOCKED:/g) ?? []).length;
    const after = (modified.match(/BLOCKED:/g) ?? []).length;
    const delta = after - before;
    totalSkips += delta;

    // Tally categories
    for (const line of modified.split("\n")) {
      const bm = line.match(/\/\/\s*BLOCKED:\s*(\S+)/);
      if (bm) {
        const cat = bm[1].replace(/,$/, "");
        categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
      }
    }

    if (!DRY_RUN) {
      fs.writeFileSync(absPath, modified, "utf-8");
      totalChanged++;
    } else {
      totalChanged++;
      console.log(`[dry-run] Would annotate ${delta} skip(s) in ${relPath}`);
    }
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log(
  `normalize-skips: ${DRY_RUN ? "DRY RUN — " : ""}${totalChanged} files, ${totalSkips} skips annotated`,
);
console.log(`${"=".repeat(60)}\n`);

console.log("Category breakdown:");
const sorted = Object.entries(categoryCount).sort(([, a], [, b]) => b - a);
for (const [cat, count] of sorted) {
  console.log(`  ${String(count).padStart(5)}  BLOCKED: ${cat}`);
}
