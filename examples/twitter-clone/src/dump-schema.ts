/**
 * Regenerate `db/schema-columns.json` — the schema file `trails-tsc`
 * reads to type model attributes (so the models never call
 * `this.attribute(...)`).
 *
 * In a typical Rails-style project you'd dump from your live database:
 *
 *   DATABASE_URL=postgres://localhost/twitter trails-schema-dump \
 *     --out db/schema-columns.json
 *
 * Here the schema is defined in code (db.ts), so we migrate a throwaway
 * in-memory DB and dump that — keeping the JSON in lock-step with the
 * `create_table` calls. Run after changing the schema:
 *
 *   pnpm dump-schema
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Base, dumpSchemaColumns } from "@blazetrails/activerecord";
import { connectAndMigrate } from "./db.js";

async function main() {
  await connectAndMigrate(); // in-memory; just need the DDL
  const schema = await dumpSchemaColumns(Base.connection);

  const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "db", "schema-columns.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(schema, null, 2) + "\n");
  console.log(`Wrote ${out}`);
  console.log(`Tables: ${Object.keys(schema).join(", ")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
