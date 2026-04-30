# Quoting Refactor: Thread Adapter Through All Call Sites

> **Status (2026-04-30):** Adapter classes (`AbstractAdapter`,
> `PostgreSQLAdapter`, `AbstractMysqlAdapter`, `SQLite3Adapter`) all have
> a `quote()` instance method, but ~14 call sites outside the adapter
> layer still import the **standalone** `quote` / `quoteIdentifier` /
> `quoteTableName` / `quoteDefaultExpression` from
> `connection-adapters/abstract/quoting.ts` and pass an
> `adapter?: "sqlite" | "postgres" | "mysql"` string to select dialect.
> That string-dispatch path duplicates dialect logic and produces wrong
> SQL on at least PG (`quote(true) → "TRUE"` instead of `"'t'"`).

## Problem

Rails routes every quoting call through the connection adapter:
`connection.quote(value)`, `connection.quote_table_name(name)`. The
`Quoting` module is mixed into `AbstractAdapter`; each concrete adapter
overrides what differs (PG: `'t'`/`'f'`, backslash escaping; MySQL:
`1`/`0`, backtick identifiers; SQLite: `1`/`0`, double-quote
identifiers). Call sites never touch the module functions directly.

Trails has the per-adapter modules in place
(`connection-adapters/{postgresql,mysql,sqlite3}/quoting.ts`) and the
adapter classes' `override quote()` methods exist, but most non-adapter
call sites still import the standalone `quote` from
`abstract/quoting.ts` and pass an `adapter` enum string. Two concrete
bugs:

1. **PG `quote(true)` returns `"TRUE"`.**
   `postgresql/quoting.ts:180` falls through to `abstractQuote` for
   booleans. Should dispatch through `quotedTrue()`
   (`postgresql/quoting.ts:62` returns `"'t'"`). MySQL's standalone
   `quote()` does this correctly (`mysql/quoting.ts:165`); PG's does
   not.

2. **Sanitization always uses abstract defaults.**
   `sanitization.ts:9–14` imports `quote`, `quoteIdentifier`,
   `quoteTableName` directly. `sanitizeSqlForConditions`
   (sanitization.ts:120–122) and `quoteBoundValue` (lines 315/326/332/ 338) emit SQL via abstract — same bug as #1, plus identifier
   quoting always uses double quotes (wrong for MySQL).

## Goal

Every quoting call goes through the active connection adapter,
matching Rails' `connection.quote` dispatch. After the refactor:

- No file outside `connection-adapters/{abstract,postgresql,mysql,sqlite3}/`
  imports from `abstract/quoting.ts`.
- The `adapter?: "sqlite" | "postgres" | "mysql"` parameter is removed
  from the abstract module.
- Each adapter class implements a shared `Quoting` interface so call
  sites can depend on a contract, not a concrete class.

## Rails source (file-anchored)

| File                                                                         | What's there                                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `activerecord/lib/active_record/connection_adapters/abstract/quoting.rb`     | Base `Quoting` module — `quote`, `quote_string`, `quoted_true/false`, etc.                           |
| `connection_adapters/postgresql/quoting.rb`                                  | PG overrides — `quote` dispatches through PG `quoted_true → 't'`                                     |
| `connection_adapters/mysql/quoting.rb` (mixed into `abstract_mysql_adapter`) | MySQL overrides — backtick identifiers, `'1'`/`'0'` bools                                            |
| `connection_adapters/sqlite3/quoting.rb`                                     | SQLite overrides — minimal divergence from abstract                                                  |
| `activerecord/lib/active_record/sanitization.rb`                             | `sanitize_sql_array`, `replace_bind_variable`, `quote_bound_value` — calls `connection.quote(value)` |

Use `bin/rails-source` to grep into the bundled Rails checkout when a
specific override is needed.

## Phase 0 — Complete adapter quoting modules

### Per-adapter gap (audited 2026-04-30)

✅ = function exists, ⚠️ = exists but has a bug or partial coverage,
❌ = missing.

| Method                           | abstract                    | postgresql                                      | mysql                     | sqlite3                     |
| -------------------------------- | --------------------------- | ----------------------------------------------- | ------------------------- | --------------------------- |
| `quote(value)`                   | ✅ `abstract/quoting.ts:57` | ⚠️ `pg/quoting.ts:156` — bool falls to abstract | ✅ `mysql/quoting.ts:163` | ✅ `sqlite3/quoting.ts:60`  |
| `quoteString(s)`                 | ✅ `:149`                   | ✅ `pg/quoting.ts:121`                          | ✅ `mysql/quoting.ts:79`  | ✅ `sqlite3/quoting.ts:56`  |
| `quoteIdentifier(name)`          | ✅ `:21`                    | ❌                                              | ❌                        | ❌                          |
| `quoteTableName(name)`           | ✅ `:33`                    | ✅ `pg/quoting.ts:78`                           | ✅ `mysql/quoting.ts:50`  | ✅ `sqlite3/quoting.ts:45`  |
| `quoteColumnName(name)`          | ✅ `:45`                    | ✅ `pg/quoting.ts:117`                          | ✅ `mysql/quoting.ts:57`  | ✅ `sqlite3/quoting.ts:52`  |
| `quoteTableNameForAssignment`    | ✅ `:158`                   | ✅ `pg/quoting.ts:136`                          | ❌                        | ✅ `sqlite3/quoting.ts:93`  |
| `quoteDefaultExpression(v)`      | ✅ `:177`                   | ✅ `pg/quoting.ts:183`                          | ❌                        | ✅ `sqlite3/quoting.ts:105` |
| `quotedTrue` / `quotedFalse`     | ✅ `:194`/`:208`            | ✅ `:62`/`:70`                                  | ✅ `:34`/`:42`            | ✅ `:29`/`:37`              |
| `unquotedTrue` / `unquotedFalse` | ✅ `:201`/`:215`            | ✅ `:66`/`:74`                                  | ✅ `:38`/`:46`            | ✅ `:33`/`:41`              |
| `quotedBinary(value)`            | ✅ `:380`                   | ✅ `pg/quoting.ts:152`                          | ✅ `mysql/quoting.ts:89`  | ✅ `sqlite3/quoting.ts:97`  |
| `typeCast(value)`                | ✅ `:90`                    | ✅ `pg/quoting.ts:208`                          | ✅ `mysql/quoting.ts:207` | ✅ `sqlite3/quoting.ts:119` |
| `castBoundValue(value)`          | ✅ `:114`                   | ❌                                              | ✅ `mysql/quoting.ts:103` | ❌                          |
| `sanitizeAsSqlComment(v)`        | ✅ `:390`                   | ❌                                              | ❌                        | ❌                          |
| `columnNameMatcher`              | ✅ `:403`                   | ✅ `pg/quoting.ts:269`                          | ✅ `mysql/quoting.ts:115` | ✅ `sqlite3/quoting.ts:315` |
| `columnNameWithOrderMatcher`     | ✅ `:419`                   | ✅ `pg/quoting.ts:288`                          | ✅ `mysql/quoting.ts:138` | ✅ `sqlite3/quoting.ts:319` |
| `lookupCastTypeFromColumn`       | ✅ `:132`                   | ✅ `pg/quoting.ts:314`                          | ❌                        | ❌                          |

### Phase 0 work items (PR 1)

**Critical (blocks Phase 2):**

- [ ] **`postgresql/quoting.ts:156–181` — fix `quote(true)`/`quote(false)`.**
      Dispatch booleans through `quotedTrue()` / `quotedFalse()` before the
      fall-through to `abstractQuote`. Current behavior returns `"TRUE"` /
      `"FALSE"`; should return `"'t'"` / `"'f'"`.
- [ ] **Add `quoteIdentifier` to all three adapter modules.**
      PG and SQLite re-export their `quoteColumnName` (both already do
      double-quote escaping). MySQL re-exports its backtick variant.
      Removes the abstract fall-back as the only `quoteIdentifier` source.

**Required for full interface (bundle with Phase 1 if size allows):**

- [ ] MySQL `quoteTableNameForAssignment(table, attr)` — backtick
      variant of the abstract default.
- [ ] MySQL `quoteDefaultExpression(value)` — delegate to MySQL
      `quote()`; abstract delegates to its own `quote`.
- [ ] PG / SQLite `castBoundValue` — delegate to abstract default.
- [ ] PG / MySQL `sanitizeAsSqlComment` — re-export from abstract
      (database-agnostic).
- [ ] MySQL / SQLite `lookupCastTypeFromColumn` — re-export abstract
      shape; PG already has its own with `checkIntegerRange`.

**Estimated size:** ~150 LOC + tests (under the 300-LOC ceiling).

## Phase 1 — Define the Quoting interface (PR 2)

**New file:** `packages/activerecord/src/connection-adapters/abstract/quoting-interface.ts`

```ts
export interface Quoting {
  quote(value: unknown): string;
  quoteString(s: string): string;
  quoteIdentifier(name: string): string;
  quoteTableName(name: string): string;
  quoteColumnName(name: string): string;
  quoteTableNameForAssignment(table: string, attr: string): string;
  quoteDefaultExpression(value: unknown): string;
  quotedTrue(): string;
  quotedFalse(): string;
  unquotedTrue(): boolean | number;
  unquotedFalse(): boolean | number;
  quotedBinary(value: Uint8Array): string;
  typeCast(value: unknown): unknown;
  castBoundValue(value: unknown): unknown;
  sanitizeAsSqlComment(value: string): string;
  columnNameMatcher(): RegExp;
  columnNameWithOrderMatcher(): RegExp;
}
```

**Wire `implements Quoting` on:**

- `AbstractAdapter` — `connection-adapters/abstract-adapter.ts:118`.
  Currently has only `quote()` (`:169`) and `typeCast()` as instance
  methods. Add the rest by binding the standalone abstract functions
  (this is the base layer; subclasses override).
- `PostgreSQLAdapter` — `postgresql-adapter.ts:85`. Already overrides
  `quoteTableName(:1890)`, `quote(:1902)`, `typeCast(:1906)`. Bind the
  remaining methods from `pg/quoting.ts`.
- `AbstractMysqlAdapter` — `abstract-mysql-adapter.ts:90`. Already
  overrides `quote(:156)`, `quoteString(:574)`, `quotedBinary(:481)`.
  Bind the rest from `mysql/quoting.ts`.
- `SQLite3Adapter` — `sqlite3-adapter.ts:82`. Already overrides
  `quote(:466)`. Bind the rest from `sqlite3/quoting.ts`.

**Use the `this`-typed top-level function pattern from CLAUDE.md.**
Each `quoting.ts` module exports the standalone functions; adapter
classes assign them as instance properties so the class satisfies
`Quoting` without delegation wrappers:

```ts
// abstract-adapter.ts
import { quote, quoteString /* … */ } from "./abstract/quoting.js";
export class AbstractAdapter implements Quoting {
  quote = quote;
  quoteString = quoteString;
  // …
}
```

Subclasses re-bind only the methods that diverge.

**Estimated size:** ~120 LOC (1 new file + ~10 method bindings on each
of 4 adapter classes).

## Phase 2 — Tier 1 (hot path) call sites

| File / line                                                                                 | Current import                                               | Change                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanitization.ts:9–14, 120–122, 315, 326, 332, 338`                                         | `quote, quoteIdentifier, quoteTableName`                     | Accept `quoter: Quoting` on `sanitizeSqlForConditions`, `quoteBoundValue`, `replaceBindVariables`. Model class methods pass `this.connection`.                                                                                        |
| `relation/query-methods.ts:19–23, 687–688, 1708`                                            | `quote, quoteTableName as quoteTable`                        | `:687–688` → `this.model.connection.quote(value)`. `:1708` → drop the `?? quoteTable(name, dialect)` fallback; adapter is always present.                                                                                             |
| `relation.ts:16–20`                                                                         | `columnNameMatcher, defaultSqlTimezone, formatInstantForSql` | These are dialect-agnostic helpers (regex + datetime formatting), not real quoting. Re-house under `connection-adapters/abstract/sql-formatting.ts` and update the import; document and skip from "no abstract/quoting imports" rule. |
| `connection-adapters/abstract-adapter.ts:32, 170`                                           | `quote as abstractQuote, typeCast as abstractTypeCast`       | After Phase 1 the class binds these by reference; drop the wrapper at `:169`.                                                                                                                                                         |
| `connection-adapters/abstract/database-statements.ts:24, 516, 538, 859, 860, 876, 885, 889` | `quoteIdentifier, quoteTableName, quoteColumnName, quote`    | Already a mixin on the adapter — switch each callsite from `quoteTableName(t)` to `this.quoteTableName(t)`.                                                                                                                           |

**PR split (each ≤300 LOC):**

- **PR 3** — sanitization: `quoter` param plumbed through 3 functions
  - ~12 caller updates. ~150 LOC.
- **PR 4** — query-methods rewire + relation.ts neutralization. ~120 LOC.
- **PR 5** — database-statements internal sweep (mechanical
  `quoteX(name)` → `this.quoteX(name)` × ~20 sites). ~80 LOC.

**Behavioral test required (in PR 3):** PG adapter integration test
asserting `Model.where({ active: true }).toSql()` emits `… "active" = 't'`
(not `"TRUE"`). Same for MySQL (`= 1`) and SQLite (`= 1`).

## Phase 3 — Tier 2 (DDL / schema)

The schema files all already receive `adapterName` as a constructor
parameter and pass it as a string to the standalone functions. Replace
`adapterName: string` with `adapter: Quoting`.

| File / line                                                                                                 | Sites                          | Notes                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `connection-adapters/abstract/schema-statements.ts:30, 53, 57, 225, 237, 242, 305, 318, 685`                | 9                              | Methods like `_qi(name) → quoteIdentifier(name, this.adapterName)` collapse to `this.adapter.quoteIdentifier(name)`.              |
| `connection-adapters/abstract/schema-creation.ts:23, 70, 83, 95, 105–117, 121, 137, 141, 152, 161–170, 182` | 18                             | Heaviest single file; constructor takes `adapterName`. Switch to `adapter: Quoting`.                                              |
| `connection-adapters/abstract/schema-definitions.ts:2, 737, 813, 830, 841, 848, 858`                        | 7                              | Same pattern.                                                                                                                     |
| `connection-adapters/postgresql/schema-creation.ts:10, 33–34`                                               | 2 — imports `abstract/quoting` | Must use `pg/quoting` (or `this.adapter`). The current `"postgres"` string args are no-ops since abstract treats them as default. |
| `connection-adapters/postgresql/schema-definitions.ts:23, 329, 341, 345, 347`                               | 4                              | Same — switch to PG quoting.                                                                                                      |

**PR split:**

- **PR 6** — abstract schema-creation + schema-definitions (share the
  constructor change). ~250 LOC.
- **PR 7** — abstract schema-statements + PG schema-creation /
  schema-definitions (PG fix is small; bundle). ~200 LOC.

## Phase 4 — Tier 3 (model / migration / association)

| File / line                                                               | Sites | Change                                                                                                                                                    |
| ------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model-schema.ts:13, 65, 70, 310, 316, 318, 319, 325, 332, 336, 340, 374` | 12    | Class methods (`createTable`, `dropTable`, `quotedTableName`) have `this.adapter` — replace `quoteX(name, adapterName)` with `this.adapter.quoteX(name)`. |
| `migration.ts:14, 1290, 1298`                                             | 3     | Migrations have `connection`. Use `connection.quoteIdentifier` / `quoteTableName`.                                                                        |
| `internal-metadata.ts:11, 50, 88, 116`                                    | 4     | Holds `_adapterName`; replace with `_adapter: Quoting`.                                                                                                   |
| `attribute-methods/primary-key.ts:6, 116–117`                             | 2     | Helper takes `adapter` string param — switch to `Quoting`. Callers already have `this.constructor.connection`.                                            |
| `associations/alias-tracker.ts:8, 40`                                     | 1     | `quoteTableName(name)` (regex anchor) — builder takes a `quoter: Quoting` arg, threaded from the relation.                                                |
| `associations/association-scope.ts:13, 500–517`                           | ~5    | Already has connection on the scope context; replace direct imports.                                                                                      |

**PR split:**

- **PR 8** — model-schema + internal-metadata + primary-key. ~200 LOC.
- **PR 9** — migration + association-scope + alias-tracker. ~150 LOC.

## Phase 5 — Remove the `adapter?:` parameter (PR 10)

Once Phases 0–4 land, this is dead code:

```sh
# Should report 0 callers outside the per-adapter quoting.ts files
grep -rn '"sqlite" | "postgres" | "mysql"' \
  packages/activerecord/src/connection-adapters/abstract/quoting.ts
```

**Steps:**

1. Remove the `adapter?: "sqlite" | "postgres" | "mysql"` parameter from
   `abstract/quoting.ts:21, 33, 45` (`quoteIdentifier`,
   `quoteTableName`, `quoteColumnName`).
2. Drop the in-function `if (adapter === "mysql")` / `"sqlite"` branches
   — routing is now done by which module's function each adapter class
   binds.
3. `quoting.test.ts:21` and `sql-default.test.ts:3` are tests of the
   abstract module specifically; their imports stay inside the
   `abstract/` boundary and remain valid.
4. Final compliance grep (acceptance #1).

**Estimated size:** ~80 LOC removed, no new code.

## Test plan

In addition to existing tests:

1. **Per-adapter `quote()` parity test** — one file, three describe
   blocks: `pgAdapter.quote(true) === "'t'"`,
   `mysqlAdapter.quote(true) === "1"`, `sqliteAdapter.quote(true) === "1"`.
   Same shape for `false`, dates, binaries.
2. **`where`-through-adapter integration** —
   `Model.where({ active: true }).toSql()` produces adapter-correct
   bool literal. Once per adapter test suite.
3. **Sanitization** —
   `sanitizeSqlForConditions(["x = ?", true], pgAdapter) === "x = 't'"`.
   Same for MySQL / SQLite.
4. **`api:compare` non-regression** — Quoting interface methods land
   on adapter classes;
   `pnpm tsx scripts/api-compare/compare.ts --package activerecord --privates`
   should be flat or improve.

## Sequencing & PR sizing

```
PR 1 ──► PR 2 ──► PR 3, 4, 5  (phase 2, parallel after PR 2)
                  PR 6, 7     (phase 3, parallel after PR 2)
                  PR 8, 9     (phase 4, parallel after PR 2)
                              └─► PR 10 (phase 5, after all above)
```

| PR  | Phase | Scope                                          | Est. LOC |
| --- | ----- | ---------------------------------------------- | -------- |
| 1   | 0     | PG `quote(bool)` fix + module gap fills        | ~150     |
| 2   | 1     | `Quoting` interface + adapter `implements`     | ~120     |
| 3   | 2     | sanitization through `quoter`                  | ~150     |
| 4   | 2     | query-methods + relation neutralize            | ~120     |
| 5   | 2     | database-statements `this.quoteX`              | ~80      |
| 6   | 3     | abstract schema-creation + schema-definitions  | ~250     |
| 7   | 3     | abstract schema-statements + PG schema files   | ~200     |
| 8   | 4     | model-schema + internal-metadata + primary-key | ~200     |
| 9   | 4     | migration + alias-tracker + association-scope  | ~150     |
| 10  | 5     | remove `adapter?:` param                       | ~80      |

Total: 10 PRs, all under the 300-LOC ceiling.

## Acceptance criteria

1. **No external imports of abstract quoting:**

   ```sh
   grep -rn 'from.*abstract/quoting' packages/activerecord/src --include='*.ts' \
     | grep -v 'connection-adapters/abstract/' \
     | grep -v 'connection-adapters/postgresql/quoting.ts' \
     | grep -v 'connection-adapters/mysql/quoting.ts' \
     | grep -v 'connection-adapters/sqlite3/quoting.ts' \
     | grep -v 'connection-adapters/abstract-adapter.ts'
   ```

   returns no results. (Test files under `abstract/` are exempt.)

2. **Adapter-specific quoting is correct (behavioral):**
   - `new PostgreSQLAdapter(...).quote(true) === "'t'"`
   - `new Mysql2Adapter(...).quote(true) === "1"`
   - `new SQLite3Adapter(...).quote(true) === "1"`

3. **Full `Quoting` interface coverage:** each adapter class satisfies
   `implements Quoting` with no `// @ts-expect-error`.

4. **No `adapter?:` enum parameter:**

   ```sh
   grep -rn '"sqlite" | "postgres" | "mysql"' packages/activerecord/src
   ```

   matches only documentation strings, not function signatures.

5. **Tests:** `pnpm test` and `pnpm test:types` green.

6. **Parity:** `pnpm parity:schema` and `pnpm parity:query` no
   regressions; private `api:compare` non-decreasing.

## Notes

- Purely internal refactor — no public API changes.
- Arel's `SubstituteBindCollector` already uses the right pattern
  (quoter interface injection); no changes there.
- MySQL's runtime SQL transformation (`mysqlQuote(sql)` that converts
  `"` to backticks) becomes redundant once all schema/relation paths
  use MySQL's quoting directly — removable as a follow-up after Phase
  4, not part of this refactor.
