/**
 * D-Y vitest setupFile for the activerecord project: loads the canonical
 * fixture schema once per worker via Base.connectionHandler (pool=1 for
 * SQLite, provisioned PG/MySQL DB for other adapters).
 *
 * Must run AFTER test-setup-ar.ts so better-sqlite3 is registered and
 * bootstrapTestHandler can open the pool.
 */
import { bootstrapTestHandler } from "./test-helpers/bootstrap-test-handler.js";
import { defineSchema, setCanonicalSchemaPreload } from "./test-helpers/define-schema.js";
import { TEST_SCHEMA } from "./test-helpers/test-schema.js";
import { Base } from "./base.js";

await bootstrapTestHandler();
await defineSchema(TEST_SCHEMA);
setCanonicalSchemaPreload(Base.adapter, TEST_SCHEMA);
