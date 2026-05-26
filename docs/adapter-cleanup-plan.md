# Adapter → Connection Collapse Plan

Goal: eliminate the `adapter` concept entirely. Rails has no "adapter"
property on models — models have `connection` (returns an
`AbstractAdapter`). Our codebase has **two parallel paths** that do the
same thing:

1. `Base.adapter` (getter in `base.ts:1053`) — the old path. Caches a
   checkout on `_adapter`, wires arel visitors, used by ~34 source files.
2. `Base.connection` (from `connection-handling.ts:412`) — the newer
   pool-based path. Delegates to `connectionPool().leaseConnection()`,
   used by ~6 source files.

These must collapse into a single `Base.connection` that subsumes the
arel-wiring and caching from the old `adapter` getter. The
`DatabaseAdapter` interface in `adapter.ts` also needs to go — it
duplicates `AbstractAdapter` and is a trails-ism Rails doesn't have.

**Why now:** Phase D landed connection-handler resolution, but ~34 files
still route through the old `adapter` getter instead of the pool-based
`connection`. Two checkout paths = two caching strategies = subtle bugs
when they disagree.

**Done-when:**

- `Base.adapter` getter, `_adapter` field, and `set adapter()` are deleted.
- All call sites use `Base.connection` (the pool-based path).
- `DatabaseAdapter` interface is deleted; all types use `AbstractAdapter`.
- `adapter.ts` barrel is deleted; surviving exports relocate to
  `connection-adapters/`.
- No `as any` casts remain for connection access.

**Test strategy:** Some tests reference `.adapter` directly or construct
mock adapters against the `DatabaseAdapter` interface. During
implementation, skip those tests with
`it.skip("pending adapter→connection rename", ...)`. Each PR that skips
tests must list them in the PR body. A final sweep PR un-skips and updates
them all.

---

## Phase 1 — Collapse the two getters (2 PRs)

### PR 1a — Delete `adapter` getter, wire call sites to `connection`

The `adapter` getter has two things `connection` doesn't:

1. **Per-class caching on `_adapter`** — Rails doesn't cache on the model
   class; `connection` delegates to `connection_pool.lease_connection` /
   `.active_connection` every time. The caching is a trails-ism. Delete it.
2. **Arel-visitor wiring (`_wireArelVisitor`)** — sets a global
   `setToSqlVisitor` singleton after checkout. In Rails this happens in
   `AbstractAdapter#initialize` (the adapter constructor), not in
   `connection`. Move it to `AbstractAdapter` construction (or the pool's
   post-checkout hook) so `connection` stays clean like Rails.

**Scope:**

- `base.ts`: delete `static get adapter()`, `static set adapter()`,
  `_adapter` field, `_wireArelVisitor`, and `clearAdapterFromDescendants`.
- Move arel-visitor wiring into `AbstractAdapter` constructor (matching
  Rails' `@visitor = arel_visitor` in `abstract_adapter.rb:155`).
- `base.ts`: add `static set connection()` for the direct-assignment
  path (`Model.connection = adapter` replaces `Model.adapter = adapter`).
- Skip tests that break; list in PR body.

**Verify:** `pnpm vitest run packages/activerecord/src/base.test.ts`

**LOC estimate:** ~200

### PR 1b — Call-site migration: `.adapter` → `.connection`

Mechanical find-and-replace across all ~34 non-test source files. No
behavioral change — every site now calls the unified `connection` getter.

**Scope:**

| Layer        | Files                                                                                                 | Pattern                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Relation     | `relation.ts`, `relation/query-methods.ts`, `relation/calculations.ts`                                | `modelClass.adapter` → `modelClass.connection`               |
| Associations | `preloader/association.ts`, `join-dependency.ts`, `association-scope.ts`, `collection-association.ts` | `klass.adapter` / `this._adapter` → lazy `connection` getter |
| Persistence  | `persistence.ts`, `insert-all.ts`, `locking/pessimistic.ts`                                           | `ctor.adapter` → `ctor.connection`                           |
| Querying     | `querying.ts`, `sanitization.ts`, `explain.ts`                                                        | `.adapter` → `.connection`                                   |
| Validations  | `validations/uniqueness.ts`                                                                           | fallback chain → single `.connection`                        |
| Schema       | `schema.ts`, `schema-dumper.ts`, `model-schema.ts`, `migration.ts`                                    | `.adapter` → `.connection`                                   |
| Other        | `timestamp.ts`, `touch-later.ts`, `transactions.ts`, `suppressor.ts`, etc.                            | `.adapter` → `.connection`                                   |

Also fixes stale-reference patterns:

- `InsertAll`: store model class, add `private get connection()`.
- `JoinDependency`: store model class, add `private get connection()`.

**Verify:** grep for remaining `.adapter` references; run affected test files.

**LOC estimate:** ~250

---

## Phase 2 — Delete `DatabaseAdapter` interface (2 PRs)

### PR 2a — Type constraints: `DatabaseAdapter` → `AbstractAdapter`

Every type annotation, generic constraint, and parameter that references
`DatabaseAdapter` switches to `AbstractAdapter` (the real Rails class).

**Scope:**

- `adapter.ts` exports `DatabaseAdapter` — all ~30 import sites switch.
- Host interfaces on Relation, QueryMethods, etc. that declare
  `adapter: DatabaseAdapter` → `connection: AbstractAdapter`.
- `SchemaStatements`, `InsertAll`, `JoinDependency` constructor params.

**Verify:** `pnpm test:types`

**LOC estimate:** ~200

### PR 2b — Delete `adapter.ts`, relocate survivors

- Move `AdapterName`, `adapterNameFromConfig` →
  `connection-adapters/abstract-adapter.ts` (where Rails defines
  `adapter_name`).
- Move `TrailsAdapterOptions`, `SQLite3AdapterOptions`,
  `MysqlAdapterOptions`, `PostgreSQLAdapterOptions` →
  `connection-adapters/pool-config.ts` (connection-establishment config).
- Move `ExplainOption`, `inspectExplainOption` →
  `connection-adapters/abstract/database-statements.ts`.
- Delete `adapter.ts`.
- Update `index.ts` re-exports.

**Verify:** `pnpm test:types` + grep for dead imports.

**LOC estimate:** ~150

---

## Phase 3 — Test sweep (1 PR)

### PR 3 — Un-skip and update tests

All tests skipped during Phases 1–2 are un-skipped and updated:

- `.adapter` → `.connection` in assertions and setup.
- Mock adapters typed against `AbstractAdapter` instead of
  `DatabaseAdapter`.
- `createTestAdapter()` helper updated if it returns `DatabaseAdapter`.

**Verify:** `pnpm vitest run` on all previously-skipped files.

**LOC estimate:** ~200

---

## Ordering

```
PR 1a (collapse getters)
  ↓
PR 1b (call-site migration) ── PR 2a (type constraints)
  ↓                               ↓
  │                            PR 2b (delete adapter.ts)
  ↓                               ↓
  └───────────── PR 3 (test sweep) ─┘
```

PRs 1b and 2a can run in parallel (non-overlapping: 1b changes runtime
call sites, 2a changes type annotations). PR 3 waits for everything else.

All PRs branch from `main` (no stacking). Each skips-then-lists affected
tests; PR 3 is the single sweep that un-skips them all.

## Non-goals (this plan)

- Renaming `connection-adapters/` directory or `AbstractAdapter` class
  (those already match Rails).
- `withConnection { }` block semantics (future pool lifecycle work).
- `connectedTo()` role-switching API (separate initiative).
