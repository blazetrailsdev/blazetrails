# DatabaseTasks Rails equivalence — Phase 2

Phase 1 (7 PRs, #2704–#2723) is complete: the `_adapterInstance`/`setAdapter`
bypass shim is removed; all tasks files are at 100% api:compare parity. This
doc tracks the residual behavioral gaps and minor clean-ups surfaced during
Phase 1 post-merge audits.

Historical Phase 1 sequence: see `git log --oneline | grep db-tasks` or
`git log --follow -- docs/activerecord/database-tasks-rails-equivalence-plan.md`.

## Phase 2 stories

### P2-1 — `migrate` missing `initialize_database` call (~30 LOC)

**Source:** PR #2706 post-merge findings.

Rails calls `initialize_database(migration_connection_pool.db_config)` at the
top of `migrate` unless `skip_initialize` is set (and callers like `migrateAll`
pass `skipInitialize: true`). Our `migrate` omits this entirely.

Fix: add `skipInitialize` param + `initialize_database(migration_connection_pool.db_config)`
call inside `migrate`; pass `skipInitialize: true` from `migrateAll`.

Files: `tasks/database-tasks.ts`.

---

### P2-2 — `createAll`/`dropAll` missing re-establish_connection (~20 LOC)

**Source:** PR #2706 post-merge findings.

Rails calls `Base.establish_connection(db_config)` after each create/drop to
refresh the pool entry. Our `createAll`/`dropAll` skip this, leaving the
handler pointing at a stale config.

Files: `tasks/database-tasks.ts`.

---

### P2-3 — `prepareAll` version-sort + post-migrate dump_schema (~15 LOC)

**Source:** PR #2706 post-merge findings.

Rails sorts configs by version in `db_configs_with_versions` before iterating,
and runs `dump_schema(config)` after each successful migrate step when
`dumpSchemaAfterMigration` is set. Our `prepareAll` does neither.

Files: `tasks/database-tasks.ts`.

---

### P2-4 — `withTemporaryPoolForEach` missing `name:` filter param (~10 LOC)

**Source:** PR #2718 post-merge findings.

Rails `with_temporary_pool_for_each(name:)` accepts a `name:` keyword to
filter to a single named DB config. We have no equivalent parameter.

Files: `tasks/database-tasks.ts`.

---

### P2-5 — SQLite path normalization in `withTemporaryPool` (~10 LOC)

**Source:** PR #2723 post-merge findings.

`withTemporaryPool` passes `config.configuration` (raw hash) to
`Base.establishConnection` without resolving relative SQLite paths against
`DatabaseTasks.root`. Pre-existing across all callers (`migrateAll`,
`reconstructFromSchema`, etc.); only `checkProtectedEnvironmentsBang` previously
escaped via the removed `_connectFor` shim.

Fix: normalize SQLite `database` path at `withTemporaryPool` entry (or at the
`SQLiteDatabaseTasks` / config-loading layer) using `DatabaseTasks.root`.
Low practical impact but breaks the Rails invariant that `root` governs
relative DB paths.

Files: `tasks/database-tasks.ts` (or `tasks/sqlite-database-tasks.ts`).

---

### P2-6 — `migrationConnection()` order-dependency registration hook (~20 LOC)

**Source:** PR #2723 post-merge findings.

`migrationConnection()` returns null if called before any async DatabaseTasks
method has had a chance to capture `_baseClass`. Root cause: `base.ts` cannot be
statically top-level-imported from `database-tasks.ts` due to a real ESM
circular dependency (`base → connection-handler → pool-config → database-tasks`).

Proper fix: add a registration hook (e.g. `DatabaseTasks._registerBase(Base)`)
that `base.ts` calls at module init time (via a side-effect import in
`model.ts`), eliminating the order dependency without a top-level import cycle.

Files: `tasks/database-tasks.ts`, `base.ts` (or `model.ts`).

---

### P2-7 — MySQL `socket`→`socketPath` remapping relocation (~10 LOC)

**Source:** PR #2710 post-merge findings.

`MySQLDatabaseTasks.establishConnection()` remaps `socket` → `socketPath` inline
as a workaround. This conversion belongs in `buildAdapterArg` (config layer) or
the `Mysql2Adapter` constructor so all callers benefit.

Files: `tasks/mysql-database-tasks.ts`, and wherever `buildAdapterArg` /
`Mysql2Adapter` constructor lives.

---

### P2-8 — 14 remaining skipped tests in `database-tasks.test.ts`

**Source:** PR #2713 post-merge findings.

14 tests remain skipped — scope/status/schema-cache gaps noted as step 2
behavioral gaps. Many of these will unskip once P2-1 through P2-3 land;
audit after those PRs.

Files: `tasks/database-tasks.test.ts`.

## Bundling guidance

P2-1 + P2-2 + P2-3 are thematically related (`migrate`/`createAll`/`dropAll`/
`prepareAll` behavioral fidelity) and together fit within the 300 LOC ceiling.
P2-4 + P2-5 are small and can be bundled together. P2-6 and P2-7 are
independent cleanups that can go separately or bundled with any of the above.
P2-8 is a follow-up audit, not its own story — attach to whichever PR closes
the last behavioral gap it depends on.
