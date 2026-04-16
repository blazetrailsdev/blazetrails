# Quoting Refactor: Thread Adapter Through All Call Sites

## Problem

In Rails, quoting is an **instance method on the connection adapter**. When code
needs to quote a value or identifier, it calls `connection.quote(value)`,
`connection.quote_table_name(name)`, etc. Each adapter (PostgreSQL, MySQL,
SQLite) overrides the base quoting module, so the right dialect is always used
automatically.

In our codebase, quoting is implemented as **standalone exported functions** in
`connection-adapters/abstract/quoting.ts`. Many call sites import these directly
and call them without any adapter context:

```ts
// sanitization.ts — no adapter, always uses abstract defaults
import { quote } from "./connection-adapters/abstract/quoting.js";
sanitizeSqlArray(template, ...binds); // quote(true) → "TRUE" always
```

This means:

- `quote(true)` always returns `"TRUE"` (should be `'t'` for PG, `"1"` for MySQL/SQLite)
- `quoteIdentifier(name)` always uses double quotes (should be backticks for MySQL)
- `quoteString(value)` uses naive escaping (PG needs `E'...'` for backslashes, MySQL needs control-char escaping)

The adapter-specific modules (`postgresql/quoting.ts`, `mysql/quoting.ts`,
`sqlite3/quoting.ts`) exist but are only wired into the adapter classes and
schema operations — not the model/relation/sanitization paths that most
user-facing queries go through.

## Goal

Every quoting call should go through the active connection adapter, matching
Rails' `connection.quote` dispatch. No code outside of the adapter itself should
import from `abstract/quoting.ts` directly.

## Call Sites to Fix

### Tier 1 — Hot path (affects every query)

These are called on every query and produce wrong SQL for non-default adapters.

| File                                                  | Imports                                      | Issue                                                                                           |
| ----------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `sanitization.ts`                                     | `quote`, `quoteIdentifier`, `quoteTableName` | No adapter context. `sanitizeSql` is called from model class methods — needs `connection.quote` |
| `relation/query-methods.ts`                           | `quote`                                      | Used in `where` clause building — bare `quote()`                                                |
| `connection-adapters/abstract/database-statements.ts` | `quote`, `quoteTableName`, `quoteColumnName` | Already within adapter context — should use `this` adapter's quoting                            |

### Tier 2 — Schema/DDL path

These affect migrations and schema operations. Some already pass `adapterName`
but still call the abstract functions instead of the adapter's overrides.

| File                                                      | Imports                                                                | Issue                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `connection-adapters/abstract/schema-statements.ts`       | `quoteIdentifier`, `quoteDefaultExpression`, `quoteTableName`, `quote` | Has `adapterName` but passes it as string param to abstract functions instead of using adapter's quoting |
| `connection-adapters/abstract/schema-creation.ts`         | `quoteIdentifier`, `quoteTableName`, `quoteDefaultExpression`          | Same — has `adapterName` constructor param                                                               |
| `connection-adapters/abstract/schema-definitions.ts`      | `quoteIdentifier`, `quoteTableName`, `quoteDefaultExpression`          | Same pattern                                                                                             |
| `connection-adapters/mysql/schema-creation.ts`            | `quoteColumnName`, `quoteTableName` from `./quoting.js`                | Correctly uses MySQL quoting                                                                             |
| `connection-adapters/sqlite3/schema-statements.ts`        | `quoteColumnName` from `./quoting.js`                                  | Correctly uses SQLite quoting                                                                            |
| `connection-adapters/postgresql/schema-creation.ts`       | `quoteIdentifier`, `quoteTableName` from `../abstract/quoting.js`      | Should use PG quoting                                                                                    |
| `connection-adapters/postgresql/referential-integrity.ts` | `quoteTableName` from `./quoting.js`                                   | Correctly uses PG quoting                                                                                |

### Tier 3 — Model/infrastructure path

These affect model setup, fixtures, and internal bookkeeping.

| File                               | Imports                                      | Issue                                                         |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| `model-schema.ts`                  | `quote`, `quoteIdentifier`, `quoteTableName` | Model has access to connection — should delegate              |
| `migration.ts`                     | `quoteIdentifier`, `quoteTableName`          | Migration has connection context                              |
| `internal-metadata.ts`             | `quoteIdentifier`, `quoteTableName`          | Has connection context                                        |
| `schema.ts`                        | `quoteIdentifier`, `quoteTableName`          | Has connection context                                        |
| `attribute-methods/primary-key.ts` | `quoteIdentifier`                            | Instance method — has access to `this.constructor.connection` |
| `associations/alias-tracker.ts`    | `quoteTableName`                             | Used to build regex for JOIN alias detection                  |
| `fixture-set/file.ts`              | `quoteIdentifier`, `quoteTableName`          | Fixture loading has connection context                        |

### Arel

Arel itself does **not** import our quoting functions. It uses a `quoter`
interface (`{ quote(value: unknown): string }`) in `SubstituteBindCollector`,
which is the correct pattern — the caller provides the quoter. This is already
aligned with Rails.

## Implementation Plan

### Phase 0: Complete adapter quoting modules

PG and MySQL quoting modules are incomplete — they only override the methods
that differ from the abstract default (booleans, string escaping, identifiers,
dates) but don't implement the full surface. Before we can thread quoting
through call sites, every adapter needs the complete set.

#### Gap table

| Method                              | Abstract |         PG          |        MySQL         | SQLite |
| ----------------------------------- | :------: | :-----------------: | :------------------: | :----: |
| `quote(value)`                      |   yes    |       **no**        |        **no**        |  yes   |
| `quoteString(s)`                    |   yes    |         yes         |         yes          |  yes   |
| `quoteIdentifier(name)`             |   yes    |       **no**        |        **no**        | **no** |
| `quoteTableName(name)`              |   yes    |         yes         |         yes          |  yes   |
| `quoteColumnName(name)`             |   yes    |         yes         |         yes          |  yes   |
| `quoteTableNameForAssignment(t, a)` |   yes    |       **no**        |        **no**        |  yes   |
| `quoteDefaultExpression(v)`         |   yes    |       **no**        |        **no**        |  yes   |
| `quotedTrue/False`                  |   yes    |         yes         |         yes          |  yes   |
| `unquotedTrue/False`                |   yes    |         yes         |         yes          |  yes   |
| `quotedDate(date)`                  |   yes    |         yes         |         yes          |  yes   |
| `quotedTime(date)`                  |   yes    |       **no**        |        **no**        |  yes   |
| `quotedBinary(value)`               |   yes    | `quoteBinaryColumn` | `quotedBinaryString` |  yes   |
| `typeCast(value)`                   |   yes    |       **no**        |       partial        |  yes   |
| `castBoundValue(value)`             |   yes    |       **no**        |        **no**        | **no** |
| `sanitizeAsSqlComment(v)`           |   yes    |       **no**        |        **no**        | **no** |
| `columnNameMatcher()`               |   yes    |       **no**        |        **no**        |  yes   |
| `columnNameWithOrderMatcher()`      |   yes    |       **no**        |        **no**        |  yes   |
| `lookupCastTypeFromColumn(col)`     |   yes    |       **no**        |        **no**        | **no** |

#### What to do

**Critical (blocks Phase 2):**

- **PG `quote(value)`**: Must dispatch through PG's own `quotedTrue()` → `'t'`,
  `quoteString()` → `E'...'` for backslashes, `quotedDate()`, etc.
- **MySQL `quote(value)`**: Same — dispatch through MySQL's `quotedTrue()` → `"1"`,
  `quoteString()` with control-char escaping, etc.

**Required for full interface (can be done in Phase 1 alongside interface):**

- PG and MySQL `quoteIdentifier(name)` — PG uses `"`, MySQL uses backticks
  (already handled by their `quoteColumnName` but not exported as
  `quoteIdentifier`)
- PG and MySQL `quoteTableNameForAssignment` — PG can delegate to abstract,
  MySQL can too (backtick version)
- PG and MySQL `quoteDefaultExpression` — PG can mostly delegate to abstract
  with PG-specific `quote()`; MySQL same
- PG and MySQL `quotedTime` — PG likely just delegates; MySQL may differ
- PG and MySQL `typeCast` — PG needs `checkIntegerRange`; MySQL has partial
  (`typecastForDatabase`) but needs full version
- Normalize binary quoting names: PG `quoteBinaryColumn` → `quotedBinary`,
  MySQL `quotedBinaryString` → `quotedBinary`

**Can delegate to abstract (add as pass-through):**

- `castBoundValue` — all three can use abstract default
- `sanitizeAsSqlComment` — database-agnostic, abstract is fine
- `lookupCastTypeFromColumn` — delegates to adapter's `lookupCastType`
- `columnNameMatcher` / `columnNameWithOrderMatcher` — PG and MySQL can use
  abstract regex version (SQLite already has its own)

### Phase 1: Define the Quoting interface

Create a `Quoting` interface that all adapters implement. This is the contract
that call sites will depend on instead of importing standalone functions.

```ts
// connection-adapters/abstract/quoting-interface.ts
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
  quotedDate(date: Date): string;
  quotedBinary(value: Uint8Array): string;
  typeCast(value: unknown): unknown;
  sanitizeAsSqlComment(value: string): string;
  columnNameMatcher(): RegExp;
  columnNameWithOrderMatcher(): RegExp;
}
```

Each adapter already has these as standalone functions in their quoting module.
Wire them into the adapter class so the adapter satisfies `Quoting`.

### Phase 2: Thread connection through Tier 1 call sites

**sanitization.ts**: Change `sanitizeSqlArray`, `sanitizeSql`, etc. to accept a
`quoter: Pick<Quoting, 'quote' | 'quoteIdentifier' | 'quoteTableName'>` param.
In Rails, these are class methods on the model that access `self.connection` —
our model class methods should pass `this.connection` when calling sanitization.

**relation/query-methods.ts**: The relation already holds a reference to the
model class. Use `this.model.connection` to get the adapter's quoting.

**database-statements.ts**: These are already adapter mixin methods. Use
`this.quote()` etc. instead of importing the standalone functions.

### Phase 3: Thread connection through Tier 2 (schema/DDL)

**SchemaCreation**: Already receives `adapterName` in constructor. Change to
receive the adapter (or its `Quoting` interface) instead. Use `this.adapter.quoteTableName()`
instead of calling standalone functions with `adapterName`.

**SchemaStatements**: Same pattern — already has `_qi()` and `_qt()` helpers.
Make them delegate to the adapter's quoting methods.

**schema-definitions.ts**: These create DDL fragments. They need a quoting
reference passed from the schema creation context.

**PG schema-creation.ts**: Switch from importing abstract quoting to using
the adapter's PG quoting methods.

### Phase 4: Thread connection through Tier 3

For each remaining file (`model-schema.ts`, `migration.ts`, `schema.ts`,
`internal-metadata.ts`, `primary-key.ts`, `alias-tracker.ts`, `fixture-set/file.ts`):
replace the direct import with delegation to the connection's quoting.

Most of these already have a connection available in their call context — it's
just not being used for quoting.

### Phase 5: Remove the adapter parameter from abstract quoting

Once all call sites go through the adapter, the `adapter?: "sqlite" | "postgres" | "mysql"`
parameter on the abstract functions becomes dead code. Remove it. The abstract
functions become the default implementation that adapter-specific modules
override — matching Rails' inheritance model.

The standalone functions in `abstract/quoting.ts` remain as the base
implementation (used by `AbstractAdapter` or as fallback), but nothing outside
the adapter layer imports them directly.

## Validation

- `pnpm test` passes for all packages
- `pnpm test:types` passes (no DX regressions)
- `pnpm run api:compare` shows no regressions
- Manual check: `quote(true)` returns `'t'`/`'f'` when PG adapter is active,
  `1`/`0` for MySQL/SQLite
- Grep for `from.*abstract/quoting` outside of `connection-adapters/` returns
  zero results

## Notes

- This is a purely internal refactor — no public API changes
- The Arel `SubstituteBindCollector` already uses the right pattern (quoter
  interface injection) and needs no changes
- MySQL's runtime SQL transformation (`mysqlQuote(sql)` that converts `"` to
  backticks) can eventually be removed once all quoting goes through the adapter,
  but that's a separate concern
