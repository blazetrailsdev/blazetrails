#!/usr/bin/env tsx
/**
 * Usage: tsx scripts/parity/schema/node/dump.ts <fixture-dir> <out.json>
 *
 * Must be run from the repo root so relative imports to packages/ resolve.
 *
 * Applies <fixture-dir>/schema.sql to a fresh SQLite database, introspects
 * it using the trails ActiveRecord adapter, canonicalizes the result, and
 * writes canonical JSON to <out.json>.
 *
 * Validates against <fixture-dir>/expected.json (D6) and exits 2 on mismatch.
 */

import Database from "better-sqlite3";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// Relative imports so tsx can resolve from source without a prior build.
// These paths resolve from the repo root (CWD when the script is run).
import { Base } from "../../../../packages/activerecord/src/base.js";
import {
  introspectTables,
  introspectColumns,
} from "../../../../packages/activerecord/src/schema-introspection.js";
import { SchemaStatements } from "../../../../packages/activerecord/src/connection-adapters/abstract/schema-statements.js";
import { canonicalize } from "./canonicalize.js";
import type { NativeDump, NativeColumn, NativeIndex } from "./canonicalize.js";

interface ExpectedManifest {
  tables: string[];
  indexCount: number;
}

function usage(): never {
  process.stderr.write("Usage: tsx scripts/parity/schema/node/dump.ts <fixture-dir> <out.json>\n");
  process.exit(1);
}

const FILTERED_TABLES = new Set(["schema_migrations", "ar_internal_metadata"]);

async function main(): Promise<void> {
  const [fixtureDir, outPath] = process.argv.slice(2);
  if (!fixtureDir || !outPath) usage();

  const fixtureDirAbs = resolve(fixtureDir);
  const outPathAbs = resolve(outPath);

  const tmpDir = mkdtempSync(join(tmpdir(), "parity-node-"));
  const dbPath = join(tmpDir, "schema.db");

  try {
    // 1. Apply schema.sql to a fresh temp SQLite file via better-sqlite3
    const sql = readFileSync(join(fixtureDirAbs, "schema.sql"), "utf8");
    const db = new Database(dbPath);
    db.exec(sql);
    db.close();

    // 2. Connect via trails adapter
    await Base.establishConnection(`sqlite3://${dbPath}`);
    const adapter = Base.adapter;
    const schemaStatements = new SchemaStatements(adapter);

    // 3. Introspect tables, columns, indexes
    const tables = (await introspectTables(adapter)).filter((t) => !FILTERED_TABLES.has(t)).sort();

    const nativeDump: NativeDump = {};

    for (const tableName of tables) {
      const cols = await introspectColumns(adapter, tableName);
      const idxDefs = await schemaStatements.indexes(tableName);

      const columns: NativeColumn[] = cols.map((col) => ({
        name: col.name,
        sqlType: col.sqlType ?? col.type ?? "",
        primaryKey: col.primaryKey,
        null: col.null,
        default: col.default !== null && col.default !== undefined ? String(col.default) : null,
        limit: col.limit,
        precision: col.precision,
        scale: col.scale,
      }));

      const indexes: NativeIndex[] = idxDefs.map((idx) => ({
        name: idx.name ?? "",
        columns: idx.columns,
        unique: idx.unique,
        where: idx.where ?? null,
      }));

      nativeDump[tableName] = { columns, indexes };
    }

    // 4. Canonicalize
    const canonical = canonicalize(nativeDump);

    // 5. Validate against expected.json (D6)
    const expected = JSON.parse(
      readFileSync(join(fixtureDirAbs, "expected.json"), "utf8"),
    ) as ExpectedManifest;

    const actualTableNames = canonical.tables.map((t) => t.name).sort();
    const expectedTableNames = [...expected.tables].sort();
    if (JSON.stringify(actualTableNames) !== JSON.stringify(expectedTableNames)) {
      process.stderr.write(
        `parity dump: table mismatch\n  expected: ${JSON.stringify(expectedTableNames)}\n  actual:   ${JSON.stringify(actualTableNames)}\n`,
      );
      process.exit(2);
    }

    const actualIndexCount = canonical.tables.reduce((n, t) => n + t.indexes.length, 0);
    if (actualIndexCount !== expected.indexCount) {
      process.stderr.write(
        `parity dump: index count mismatch\n  expected: ${expected.indexCount}\n  actual:   ${actualIndexCount}\n`,
      );
      process.exit(2);
    }

    // 6. Write canonical JSON
    writeFileSync(outPathAbs, JSON.stringify(canonical, null, 2) + "\n");
    process.stdout.write(`parity dump (trails): wrote ${outPathAbs}\n`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`parity dump: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
