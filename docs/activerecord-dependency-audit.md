# ActiveRecord Dependency Audit

Where `packages/activerecord/src/` reimplements functionality inline
instead of using sibling packages, or builds SQL via string
interpolation instead of Arel AST nodes.

Snapshot 2026-04-30. Most of the original audit has been executed; what
remains is below.

## 1. Raw SQL strings instead of Arel

### `base.ts` — empty-row INSERT (line 2466)

```typescript
sql = `INSERT INTO "${table.name}" ${emptyValue}`;
```

Used when `create` runs with no attribute writers. Should route through
`InsertManager` like the non-empty branch on line 2469. Also: the
hard-coded `"…"` identifier quoting is a dialect parity gap — should use
the adapter's `quoteTableName`.

`_performUpdate` (line 2487) was on the original list but is now
migrated to `UpdateManager`.

### Infrastructure files (lower priority — not on the hot path)

- `schema-migration.ts:47` — `CREATE TABLE IF NOT EXISTS "schema_migrations" …`
- `migration-runner.ts:37,45,63,85` — schema_migrations CREATE / SELECT
  / INSERT / DELETE
- `internal-metadata.ts:88` — `CREATE TABLE IF NOT EXISTS …`

Rails uses Arel here too. These are bookkeeping tables, not user-data
queries — safe to defer.

## 2. ActiveSupport utilities not yet used

Verified by grep against `packages/activerecord/src/`:

| Utility                     | Usage today | Notes                                                                                                                                                                      |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TimeWithZone`              | 0 files     | Temporal migration replaced most of what Rails uses TimeWithZone for; revisit only if a specific feature needs it.                                                         |
| `MessageEncryptor`          | 0 files     | `encryption/` has its own crypto. Rails delegates to ActiveSupport — would be a refactor, not net new code.                                                                |
| `CurrentAttributes`         | 0 files     | Rails uses this for request-scoped state (`Current.user`, etc.). Need a story for this in trails — likely belongs to actionpack/trailties wiring rather than activerecord. |
| `MemoryStore` / `FileStore` | 0 files     | Query cache uses an inline Map. Could swap to `ActiveSupport::Cache` stores once the cache API stabilizes.                                                                 |
| `BroadcastLogger`           | 0 files     | Multi-destination logging not yet wired.                                                                                                                                   |

`HashWithIndifferentAccess`, `Notifications`, `Duration`,
`MessageVerifier`, `Logger`, and the inflectors are all in use.

## 3. ActiveModel integration

Solid. Verified status:

- **Validators** extend activemodel base classes (`PresenceValidator`,
  `AbsenceValidator`, `LengthValidator`, `NumericalityValidator`,
  `EachValidator`).
- **Type system** shared with activemodel (`Type`, `ValueType`,
  `StringType`, `IntegerType`, `BooleanType`, etc.).
- **Callbacks** delegate to activemodel. `Base extends Model` provides
  the callback chain; `callbacks.ts` registers AR-specific callbacks
  (`beforeSave`, `afterSave`, etc.) on top.
- **Dirty tracking** delegates to activemodel.
  `attribute-methods/dirty.ts` adds persistence-aware methods
  (`savedChangeToAttribute`, `attributeBeforeLastSave`) reading from
  activemodel's `previousChanges` / `changes`.
- **Errors** — `errors.ts` defines AR-specific error classes
  (`RecordNotFound`, `RecordInvalid`, `StatementInvalid`); distinct from
  `ActiveModel::Errors` (validation messages on a record). Matches Rails.
- **`ActiveModel::Attribute`** — arel depends on activemodel (#626);
  `Arel::Nodes.buildQuoted` routes `ActiveModel::Attribute` instances
  through `BindParam`, matching Rails' `visit_ActiveModel_Attribute → add_bind`.

## Priority order

1. **Empty-row INSERT in `base.ts`** — small, mechanical migration to
   `InsertManager`. Folds in the dialect-parity quoting fix.
2. **Cache stores swap** — query cache → `ActiveSupport::Cache::MemoryStore`.
   Worth doing once any consumer needs Rails-shaped cache semantics
   (TTL, namespace, instrumentation).
3. **`CurrentAttributes`** — pick up when actionpack request scoping
   lands; likely lives in trailties wiring rather than activerecord.
4. **`MessageEncryptor` rebase** for `encryption/` — refactor only,
   defer until encryption gets its next round of work.
5. Infrastructure raw SQL — last; cosmetic until parity-tested.
