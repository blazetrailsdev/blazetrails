# Shared adapter test-suite plan

Plan for running the shared `activerecord` test suite against all three
adapters (sqlite3, postgresql, mysql2), the way Rails does — instead of
the current setup where shared tests only ever exercise SQLite and
adapter-specific behavior lives in adapter-named files.

## Current state (the blocker)

61 test files in `packages/activerecord/src/**/*.test.ts` call
`defineSchema` / `establishConnection`, and most contain a literal
`new SQLite3Adapter(":memory:")`. The adapter is baked into each test, so
there's no axis to vary. PG and MySQL only see what's under
`adapters/postgresql/**`, `connection-adapters/postgresql-adapter*.test.ts`,
etc. — a small fraction of the suite.

Rails avoids this by never naming an adapter in shared tests. The adapter
is chosen by `ARCONN` at bootstrap and the same test files are run three
times. The Rakefile fans out into `test:sqlite3`, `test:postgresql`,
`test:mysql2`; per-adapter files under `test/cases/adapters/<name>/**`
are only loaded for the matching run via a `t.test_files` glob — not via
`if` branching inside the tests.

## Design goals

1. Run the same shared test files against sqlite3, postgres, and mysql2.
2. Make capability gates explicit and typed; eliminate silent "DB not
   reachable → skip" in CI.
3. Don't regress local dev: `pnpm vitest run foo.test.ts` should still
   Just Work on a laptop with no Postgres.
4. Keep adapter-specific files (PG arrays, MySQL charset, sqlite3 pragmas)
   where they are — they shouldn't be forced through the shared axis.

## Phase 1 — Test-adapter abstraction (the keystone)

Add `packages/activerecord/src/test-helpers/test-adapter.ts`:

```ts
export type TestAdapterName = "sqlite3" | "postgresql" | "mysql2";
export function currentTestAdapter(): TestAdapterName;
export function newTestAdapter(opts?): AbstractAdapter;
export function ifAdapter(name: TestAdapterName, fn: () => void): void;
export function supportsForeignKeys(): boolean;
export function supportsArrays(): boolean;
// ...
```

Selection rule: `process.env.TEST_ADAPTER ?? "sqlite3"`. Connection strings
come from env (`PG_TEST_URL`, `MYSQL_TEST_URL`) with localhost defaults —
the pattern already used in
`packages/activerecord/src/connection-adapters/postgresql-adapter.test.ts`.

Capability gates replace the file-name convention: a test that needs
arrays calls `it.skipIf(!supportsArrays())(...)`. This is the typed
analogue of Rails' `current_adapter?(:PostgreSQLAdapter)`.

**Why this first:** every later phase depends on it, and it's
mechanically isolated — no test changes yet.

## Phase 2 — Codemod the 61 shared files

A one-time codemod (ts-morph or jscodeshift) rewrites:

- `new SQLite3Adapter(":memory:")` → `newTestAdapter()`
- Inline `defineSchema({ adapter: "sqlite3", ... })` → drop the adapter
  key; let `newTestAdapter` decide
- Inline column types that don't exist on PG/MySQL (`BLOB`,
  `INTEGER PRIMARY KEY AUTOINCREMENT`) → schema DSL terms or gate with
  `supportsX()`

PR-by-PR: ship the codemod + helper in one PR (~200 LOC), then split the
61 files into ~5 PRs of ~12 files each (well under the 300 LOC ceiling).
Each file is independently revertable.

Robustness win independent of multi-adapter: removing literal
`":memory:"` strings from 61 places eliminates a class of "test passed
because it ran against the wrong DB" bugs.

## Phase 3 — Per-worker schema/state isolation

`#1092` already gives each Vitest worker its own SQLite file. Extend that:

- **sqlite3:** per-worker `file:test-w${WORKER_ID}.db?mode=memory&cache=shared`
  (already shipped).
- **postgresql:** per-worker `rails_js_test_w${WORKER_ID}`, created/dropped
  by `globalSetup` that issues `CREATE DATABASE` per worker. Alternative:
  one DB with per-worker `search_path` — cheaper but races on
  schema reset.
- **mysql2:** per-worker schema, same pattern.

Add a `beforeEach` hook in a shared setup file: `await dropAllTables()`.
Today `test-helpers/drop-all-tables.ts` is sqlite-shaped; generalize it
via the adapter's introspection API (`tables()`,
`dropTable(name, cascade: true)`) — all three adapters already expose
this.

Robustness win: removes the "schema bled from previous test" failure
mode currently papered over by hard-coding `:memory:`.

## Phase 4 — CI matrix

`.github/workflows/...` gains a matrix dimension:

```yaml
strategy:
  matrix:
    adapter: [sqlite3, postgresql, mysql2]
services:
  postgres: { image: postgres:16, ... } # only on the postgresql leg
  mysql: { image: mysql:8, ... } # only on the mysql2 leg
env:
  TEST_ADAPTER: ${{ matrix.adapter }}
```

The connectivity probe stops being a silent-skip: in `newTestAdapter()`,
if `process.env.CI === "true"` and the connection fails, **throw**.
Locally it still skips.

Three parallel jobs ≈ wall-clock unchanged from today (each leg runs ~⅓
of the CPU work the current full-AR job does, plus Vitest's intra-job
parallelism). Net effect: triple the coverage for the same wall clock,
at ~2× CI minutes.

## Phase 5 — Adapter-specific file reclassification

Once shared tests run everywhere, audit `adapters/postgresql/**` and
`connection-adapters/postgresql-adapter*.test.ts`:

- Tests that exercise PG-only **behavior** (arrays, hstore, ranges, OID)
  stay where they are; only loaded on the PG run via Vitest `include` /
  `exclude` keyed off `TEST_ADAPTER` — mirroring Rails' Rakefile glob.
- Tests that just happen to live there because of fixture coupling move
  into shared and gate on capability checks.

Update `vitest.config.ts`:

```ts
exclude: [
  ...(process.env.TEST_ADAPTER !== "postgresql"
    ? ["**/adapters/postgresql/**", "**/postgresql-*.test.ts"]
    : []),
  ...(process.env.TEST_ADAPTER !== "mysql2" ? ["**/adapters/mysql/**", "**/mysql-*.test.ts"] : []),
];
```

This is the load-path gating that Rails does, expressed in our world.

## Phase 6 — `test:compare` impact

`test:compare` matches our tests to Rails tests by name. Today a Rails
test that runs on all three adapters maps to one of ours that only runs
on SQLite. After this work, the mapping is unchanged (still one TS test
per Rails test) but the effective coverage goes up. Worth adding a
"ran-on-adapter" annotation to the compare report so we can see which
Rails tests are still only covered on SQLite.

## Risks & tradeoffs

- **PG/MySQL flake.** Real DBs in CI flake. Mitigation: pinned
  service-container versions; retry on connection-establish, not on
  test bodies.
- **Schema-dialect divergence.** Some shared tests will fail on PG/MySQL
  because the implementation has a gap, not the test. That's the point —
  it surfaces real fidelity issues — but expect a backlog of skips on
  the first green run. Plan to land Phase 2 with
  `it.skipIf(currentTestAdapter() !== "sqlite3")` for files we know will
  fail, then peel skips off one cluster at a time using the existing
  `:BLOCKED:` annotation convention from `normalize-skips.ts`.
- **Local dev friction.** Most contributors won't have Postgres running.
  The `CI=true` branch in the probe keeps `pnpm vitest run` painless
  locally; only CI is strict.
- **Schema-reset cost on PG.** `DROP TABLE` per test is ~50 ms × N. If
  it hurts, switch to transactional fixtures (begin → test body →
  rollback). Rails uses this by default; we'd need
  `Base.connection.beginTransaction()` in `beforeEach` and rollback in
  `afterEach` — already supported by our TM.

## Suggested PR sequence

| #   | Scope                                                                                 | LOC est. |
| --- | ------------------------------------------------------------------------------------- | -------- |
| 1   | `test-adapter.ts` helper + capability gates, no consumers yet                         | ~200     |
| 2   | Codemod script + first 12 files migrated (sqlite still default)                       | ~250     |
| 3–5 | Remaining ~50 files in 3 PRs                                                          | ~250 ea  |
| 6   | Generalize `drop-all-tables` via adapter introspection + per-worker PG/MySQL DB setup | ~250     |
| 7   | CI matrix + strict-on-CI probe                                                        | ~100     |
| 8   | `vitest.config.ts` load-path gating + adapter-file reclassification audit             | ~200     |
| 9+  | Peel skips per cluster as fidelity gaps are fixed                                     | rolling  |

PRs 1–7 are infrastructure; #8 onward is incremental coverage gain. The
first real signal arrives at PR 7 — that's when the PG/MySQL legs first
run the shared suite.

## What this gets us

- **Coverage:** ~3× more Rails tests effectively exercised per CI run.
- **Robustness:** silent-skip → hard-fail in CI; schema bleed eliminated;
  "ran on the wrong adapter" bugs gone.
- **Speed:** wall-clock roughly flat (parallel matrix legs); CI minutes
  ~2× higher.
- **Fidelity signal:** every cluster of failures-on-PG-but-not-sqlite is
  a real implementation gap surfaced for free.
