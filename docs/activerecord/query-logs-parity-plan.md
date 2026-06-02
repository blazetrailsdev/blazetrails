# QueryLogs — True Rails Parity Plan

## Goal

Make `ActiveRecord::QueryLogs` a real query transformer in trails: wired into
the actual SQL-execution path so that **real model queries emit the comment**,
backed by an `assertQueriesMatch` test helper, with
`packages/activerecord/src/query-logs.test.ts` rewritten to mirror the Rails
counterpart verbatim and dropped from `eslint/test-fixture-parity-exclude.json`.

Today the `QueryLogs` class is fully implemented and unit-tested, but it is
**never invoked by the query pipeline**. The TS test exercises it as a pure
unit (`logs.call("SELECT 1")`); the Rails test drives it through real queries
(`Dashboard.first`, `connection.execute "SELECT 1"`) and asserts the appended
comment via `assert_queries_match`. That gap is why every active test in the
file is flagged by `test-fixture-parity` and why the file sits on the exclude
baseline.

This is **feature work, not a fixture swap** — see the ordering finding in
[Key architectural finding](#key-architectural-finding-instrumentation-ordering).

## Current state (what exists vs. what's missing)

| Piece                                                                      | Status                                                                           | Location                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `QueryLogs` class (tags, formatters, cache, `call(sql)`, `comment()`)      | ✅ Implemented + unit-tested                                                     | `src/query-logs.ts`, `src/query-logs-formatter.ts`             |
| `LegacyFormatter` / `SQLCommenter`                                         | ✅ Implemented                                                                   | `src/query-logs-formatter.ts`                                  |
| `ExecutionContext` (`set`, `setKey`, `toH`, `clear`)                       | ✅ Implemented                                                                   | `activesupport/src/execution-context.ts`                       |
| `preprocessQuery(sql)` adapter hook                                        | ⚠️ Exists but **no transformer loop** — only write-checks, returns sql unchanged | `src/connection-adapters/abstract/database-statements.ts:1648` |
| `internalExecute` → `preprocessQuery` → `rawExecute` chain                 | ✅ Wired                                                                         | `database-statements.ts:1660`                                  |
| Global `ActiveRecord.queryTransformers` registry                           | ❌ Missing                                                                       | —                                                              |
| `QueryLogs` singleton + registration into the registry                     | ❌ Missing — class exported from `index.ts` but never instantiated               | `src/index.ts:178`                                             |
| `context[:connection]` injection + `call(sql, connection)` 2-arg signature | ❌ Missing — our `call(sql)` takes one arg                                       | `src/query-logs.ts:167`                                        |
| `ExecutionContext.afterChange` cache-clear hook                            | ❌ Missing                                                                       | `activesupport/src/execution-context.ts`                       |
| `assertQueriesMatch` / `SQLCounter` test helper                            | ❌ Missing                                                                       | —                                                              |
| `sql.active_record` notification carries the **commented** SQL             | ❌ **No** — fires pre-transform (see below)                                      | `database-statements.ts:1271`                                  |

## Rails reference

```ruby
# abstract/database_statements.rb
def preprocess_query(sql)
  check_if_write_query(sql)
  mark_transaction_written_if_write(sql)
  ActiveRecord.query_transformers.each { |t| sql = t.call(sql, self) }   # ← the loop we lack
  sql
end

def raw_execute(sql, name = nil, ...)   # ← `log { ... }` lives HERE, with commented sql
  log(sql, name, ...) { ... }
end

def internal_execute(sql, ...)
  sql = preprocess_query(sql)            # ← transform BEFORE raw_execute/log
  raw_execute(sql, name, binds, ...)
end
```

```ruby
# query_logs.rb
def call(sql, connection)
  comment = self.comment(connection)
  return sql if comment.blank?
  prepend_comment ? "#{comment} #{sql}" : "#{sql} #{comment}"
end

def comment(connection)
  context = ActiveSupport::ExecutionContext.to_h
  context[:connection] ||= connection            # ← the two skipped tests need this
  ...
end

ActiveSupport::ExecutionContext.after_change { ActiveRecord::QueryLogs.clear_cache }
```

`assert_queries_match` subscribes a `SQLCounter` to `sql.active_record` and
matches the payload `:sql` against a regex. It sees the comment **because in
Rails `log` runs inside `raw_execute`, after `preprocess_query`.**

## Key architectural finding (instrumentation ordering)

In trails the order is **inverted** relative to Rails:

```
internalExecQuery(sql)                       database-statements.ts:1264
  └─ logSql(this, sql, ...)   ← fires `sql.active_record` with the ORIGINAL sql
       └─ internalExecute(sql)               :1276
            └─ preprocessQuery(sql)          ← transform happens HERE, too late
                 └─ rawExecute(processed)
```

`logSql` wraps execution with the **pre-transform** SQL, so even after we add
the transformer loop to `preprocessQuery`, the `sql.active_record` payload —
and therefore any `assertQueriesMatch` helper — would **not** see the comment.

To match Rails we must instrument the **post-preprocess** SQL. Two options:

- **Option A (Rails-faithful): move `log`/instrumentation into `rawExecute`.**
  Highest fidelity, but ripples across every concrete adapter and every test
  that asserts on `sql.active_record` payloads — large blast radius.
- **Option B (minimal): preprocess before instrumenting.** Hoist
  `preprocessQuery` so `logSql` receives the already-transformed SQL — e.g.
  `internalExecQuery` calls `preprocessQuery` and passes the processed SQL to
  `logSql`, with `internalExecute` not re-preprocessing. Smaller diff,
  preserves the comment in the payload, but diverges from Rails' exact call
  layout (acceptable — `api:compare` checks method _presence_, not internal
  ordering).

**Recommendation: Option B**, with a focused refactor so `preprocessQuery`
runs exactly once per query. This is the load-bearing decision; it should be
locked before the integration PRs land. This ordering subtlety — not the
`QueryLogs` class itself — is the real work and the reason a "just add
`useHandlerFixtures`" migration is impossible.

## Implementation plan (PR-sized, each branched from `main`, non-overlapping files)

Per CLAUDE.md: no stacked PRs, ≤300 LOC each (this file targets ≤300),
sibling branches off `main` with non-overlapping files, merged sequentially.

### PR 1 — `queryTransformers` registry + `QueryLogs` 2-arg `call` + connection context

- Add a global mutable `queryTransformers: QueryTransformer[]` registry
  (mirrors `ActiveRecord.query_transformers`) with a typed
  `QueryTransformer = { call(sql: string, connection: unknown): string }`.
- Extend `QueryLogs.call` to the Rails 2-arg shape `call(sql, connection?)`;
  inject `context.connection ||= connection` in `comment()` so the two
  currently-skipped tests (`connection is passed to tagging proc`,
  `connection does not override already existing connection in context`)
  have their dependency satisfied. Keep `call(sql)` working (connection
  optional) for the existing unit tests.
- **Files:** `src/query-logs.ts`, `src/query-transformers.ts` (new),
  `src/index.ts` (export), plus unit tests. No adapter edits.
- **Smoke test only** here; full integration proof lands in PR 3.

### PR 2 — `ExecutionContext.afterChange` → `QueryLogs.clearCache`

- Add an `afterChange(fn)` subscription to `ExecutionContext` in activesupport
  and fire subscribers from `set`/`setKey`/`clear`.
- Register `QueryLogs.clearCache` so cached comments invalidate on context
  change (mirrors `query_logs.rb` `after_change`).
- **Files:** `activesupport/src/execution-context.ts` (+ test). Cross-package,
  but isolated — no overlap with PR 1/3.

### PR 3 — Wire transformers into `preprocessQuery` + fix instrumentation ordering (Option B)

- Add the transformer loop to `preprocessQuery`:
  `for (const t of queryTransformers) sql = t.call(sql, this);`
- Apply the Option B reorder so `logSql` instruments the post-preprocess SQL
  (preprocess once, before instrumentation).
- **Files:** `src/connection-adapters/abstract/database-statements.ts` (+ its
  test). This is the load-bearing PR — guard against double-preprocessing and
  verify no existing `sql.active_record` assertions regress.

### PR 4 — `assertQueriesMatch` test helper (`SQLCounter`)

- Port Rails' `SQLCounter` + `assertQueriesMatch(match, { count? })`:
  subscribe to `sql.active_record`, collect non-SCHEMA queries, assert ≥1 (or
  exact `count`) match a regex/string.
- **Files:** `src/test-helpers/assert-queries-match.ts` (+ test). Pure
  addition, no overlap.

### PR 5 — Migrate `query-logs.test.ts` to Rails parity + drop from exclude list

- Rewrite the fixture-flagged tests to drive real queries through the
  canonical `Dashboard` model (`src/test-helpers/models/dashboard.ts`) +
  `useHandlerFixtures(["dashboards"])`, asserting the comment via
  `assertQueriesMatch` — mirroring `query_logs_test.rb` verbatim (test names,
  `application:active_record` tagging via `ExecutionContext`, `Dashboard.first`,
  `connection.execute "SELECT 1"`).
- Keep the genuinely-unit tests (`escaping good comment`, formatter classes,
  `GetKeyHandler`) as-is — their Rails counterparts use `send(:escape_sql_comment)`
  directly and don't touch fixtures.
- Unskip `connection is passed to tagging proc` +
  `connection does not override already existing connection in context`.
- Use `{ schema: canonicalSchema }` to defend against sibling-file schema
  contamination.
- **Final step:** remove
  `packages/activerecord/src/query-logs.test.ts` from
  `eslint/test-fixture-parity-exclude.json`.
- **Files:** `src/query-logs.test.ts`, `eslint/test-fixture-parity-exclude.json`.

## Verification (per PR and final)

- `pnpm vitest run packages/activerecord/src/query-logs.test.ts` — green,
  no skipped fixture-flagged tests.
- `npx eslint packages/activerecord/src/query-logs.test.ts` — 0
  `blazetrails/test-fixture-parity` errors after PR 5.
- `pnpm run api:compare --package activerecord` — `QueryLogs#call` /
  `query_transformers` surface covered.
- Regression guard for PR 3: existing tests subscribing to
  `sql.active_record` (e.g. `query-cache.test.ts`, `base.test.ts`,
  `counter-cache.test.ts`) still pass.
- Do **not** run the full suite locally; rely on CI per CLAUDE.md.

## Risks / open questions

1. **Instrumentation reorder (PR 3)** is the highest-risk change. Lock Option
   A vs. B before starting; B is recommended for blast radius.
2. **Global mutable registry + ExecutionContext** are process-global; tests
   must save/restore `queryTransformers`, `tags`, and clear `ExecutionContext`
   in `beforeEach`/`afterEach`, exactly as the Rails `setup`/`teardown` does.
3. **`application: -> { "active_record" }` tagging** — Rails sets this default
   in `setup`; the TS port must register the same default taggings so
   `Dashboard.first` emits `/*application:active_record*/`.
4. If PR 3's reorder proves too invasive, fall back to Option A (instrument in
   `rawExecute`) as a larger, separately-scoped refactor — but that should not
   block PRs 1, 2, 4, which are independently valuable.

## Sequencing

PRs 1, 2, 4 are independent and can land in parallel (non-overlapping files).
PR 3 depends on PR 1 (needs the registry). PR 5 depends on PRs 1–4. Merge
order: {1, 2, 4} → 3 → 5.
