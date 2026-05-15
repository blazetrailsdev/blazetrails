# MariaDB CI failure investigation (PRs #1594, #1603)

## Summary

Not a flake — **deterministic regression** on the MariaDB CI job introduced
by commit `dbad36faa` (#1599 _MySQL active-schema Slot B_). Every push on
`main` since that commit (5efc1f6e, e57eda6c) and every PR branch that
rebases past it (including #1594 and #1603) fails the MariaDB job with the
same error in the same test.

Failing test:
`packages/activerecord/src/migration.test.ts:712`
`Migration DDL (extended) > addIndex with ifNotExists option`

Root cause is **not** a MariaDB-specific timing/connection issue — it is a
mismatch between (a) what the test asserts about `addIndex(..., {
ifNotExists: true })` and (b) what `AbstractMysqlAdapter.addIndex`
actually does on the MySQL/MariaDB code path. The second `addIndex` call
re-issues `CREATE INDEX` without `IF NOT EXISTS`, producing
`ER_DUP_KEYNAME`. (Why it began failing exactly at #1599 is still
partially undetermined — see "Open question" below.)

## Evidence

Three runs, all the same failure:

| PR    | Run         | Job         | Started              | Conclusion |
| ----- | ----------- | ----------- | -------------------- | ---------- |
| #1594 | 25923880981 | 76202469627 | 2026-05-15T14:55:58Z | FAILURE    |
| #1603 | 25925063836 | 76204017323 | 2026-05-15T15:04:48Z | FAILURE    |
| #1603 | 25925445208 | 76205436943 | 2026-05-15T15:13:10Z | FAILURE    |

Identical error excerpt (all three runs):

```
FAIL activerecord packages/activerecord/src/migration.test.ts >
  Migration DDL (extended) > addIndex with ifNotExists option

Serialized Error: {
  code: 'ER_DUP_KEYNAME',
  errno: 1061,
  sql: 'CREATE INDEX `index_users_on_email` ON `users` (`email`)',
  sqlState: '42000',
  sqlMessage: "Duplicate key name 'index_users_on_email'"
}
```

`main` CI history (from `gh run list --workflow=CI --branch=main`):

```
14:53:54Z failure e57eda6c push    (#1598 merged)
14:52:09Z failure 5efc1f6e push    (#1600 merged)
14:38:18Z failure dbad36fa push    (#1599 merged) ← first failure
14:35:02Z success 4948b28b push    (#1601 merged) ← last green
14:25:53Z success 580f38f7 push    (#1597 merged)
... all prior runs green
```

## Reproducibility classification

**Deterministic, branch-independent.** Hits every PR rebased onto current
`main`. Not affected by re-run. Not adapter timing.

## Failure mechanism

`packages/activerecord/src/migration.test.ts:712`:

```ts
it("addIndex with ifNotExists option", async () => {
  const adapter = freshAdapter();
  const spy = vi.spyOn(adapter, "executeMutation");
  class AddIdxIfNotExists extends Migration {
    async up() {
      await this.createTable("users", (t) => {
        t.string("email");
      });
      await this.addIndex("users", ["email"], { ifNotExists: true });
      await this.addIndex("users", ["email"], { ifNotExists: true });
    }
    async down() {}
  }
  const m = new AddIdxIfNotExists();
  await m.run(adapter, "up");
  const indexCalls = spy.mock.calls.filter(
    ([sql]) => typeof sql === "string" && sql.includes("IF NOT EXISTS"),
  );
  expect(indexCalls).toHaveLength(2);
});
```

The test has **no** `it.skipIf(adapterType === "mysql")` guard, so it
runs on the MariaDB job.

MySQL/MariaDB `addIndex` path
(`packages/activerecord/src/connection-adapters/abstract-mysql-adapter.ts:707`):

```ts
async addIndex(tableName, columnName, options = {}) {
  const ss = this.schemaStatements();
  const [idx, algorithmClause, ifNotExists] =
    ss.addIndexOptions(tableName, columnName, options);
  if (ifNotExists && (await ss.indexExists(tableName, idx.columns, { name: idx.name }))) {
    return;
  }
  const createDef = new CreateIndexDefinition(idx, false, algorithmClause);
  await this._execMutation(new MysqlSchemaCreation().accept(createDef));
}
```

Two mismatches:

1. **No `IF NOT EXISTS` keyword is ever emitted.** `CreateIndexDefinition`
   is constructed with `false` for the `ifNotExists` flag. The test's
   `sql.includes("IF NOT EXISTS")` filter would therefore find 0 calls
   even on a fully successful run. Expected: `toHaveLength(2)`. This
   alone guarantees the test cannot pass on the MariaDB adapter as
   currently written — the spec encodes Postgres-style DDL behavior
   (`postgresql-adapter.ts:3727` _does_ splice an `IF NOT EXISTS` literal
   into the SQL), but Rails' MySQL adapter, and our mirror, implement
   `ifNotExists` via a pre-flight `indexExists` lookup instead.

2. **The pre-flight `indexExists` lookup is failing to detect the just-
   created index on MariaDB**, so the second `addIndex` proceeds to
   `_execMutation` and trips `ER_DUP_KEYNAME`. If the pre-flight worked,
   the second call would early-return and the test would still fail —
   but with `expected 2, got 1` rather than an unhandled rejection.

`indexExists` (`abstract/schema-statements.ts:917`) calls
`this.indexes(tableName)` against the live DB. Either (a) the MariaDB
implementation of `indexes()` doesn't see the index until a metadata
refresh, or (b) name normalization differs (the queried name
`index_users_on_email` quoting vs. information_schema lookup), or (c)
schema cache stale. Not yet root-caused; #1599 did not directly modify
either `addIndex` or `indexes`.

## Open question — why did #1599 flip it?

#1599's diff does not obviously affect this code path. It modified:
`MysqlSchemaCreation.typeToSql` (lowercase types), `createDatabase`,
`dropDatabase`, `recreateDatabase`, `indexAlgorithms` (added `instant`),
and reordered `SchemaStatements.indexAlgorithm` error semantics. The
addition of an override `MysqlSchemaStatements.schemaCreation` (in
`mysql2-adapter.ts`) returning a `MysqlSchemaCreation` instance is the
most suspicious item — it could change which `accept` visitor runs for
`CreateIndexDefinition`, and (indirectly) the `indexes()` reflection path
or `IndexDefinition` shape. Worth bisecting locally against a MariaDB
container before committing to a fix to confirm the flip-point.

## Recommended action

**(c) Test-side fix, plus a small adapter-side audit.** Two changes,
both small enough to bundle into one PR (~30–60 LOC):

1. `packages/activerecord/src/migration.test.ts:712` — gate with
   `it.skipIf(adapterType === "mysql")` (matching the adjacent tests at
   lines 657 and 685 which already skip on MySQL for the same
   `IF NOT EXISTS` SQL-shape reason), OR split into two adapter-specific
   assertions:
   - On `postgres` / `sqlite`: assert two SQL strings contain
     `IF NOT EXISTS`.
   - On `mysql`: assert exactly one `CREATE INDEX` is executed (the
     pre-flight short-circuits the second).

2. Adapter-side follow-up (separately, not blocking the CI unblock):
   confirm `MysqlSchemaStatements.indexes(tableName)` returns the
   freshly created index synchronously after `addIndex`. If it does,
   ship only the test gate. If it doesn't, also file a bug for the
   `indexes()`/schema-cache freshness gap.

The test gate alone is enough to restore green CI on MariaDB.

## Followup sizing

- **Immediate (test gate)**: ~5 LOC. One-line `it.skipIf` plus a Rails-
  source link in a comment. Belongs in `docs/activerecord-100-clusters.md`
  under the migration / DDL cluster.
- **Deferred (indexes() freshness, if reproduced)**: scope unknown until
  reproduced — likely 20–80 LOC in
  `packages/activerecord/src/connection-adapters/mysql2-adapter.ts` or
  `mysql/schema-statements.ts`. Same cluster.
- **Optional follow-up**: extend the assertion split so the MariaDB job
  _also_ gets meaningful coverage of the `ifNotExists` pre-flight path
  (assert exactly one underlying `CREATE INDEX` ran, no duplicate).

## Cross-PR confirmation

#1594 (`pg-virtual-column-slot-b-live-pg-round-t`) and #1603
(`implement-wave-1-of-the-actionpack-restr`) share no source overlap
relevant to MySQL DDL. Both are simply rebased past dbad36faa. This is
a `main`-side regression, not anything either PR introduced.
