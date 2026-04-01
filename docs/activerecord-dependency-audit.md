# ActiveRecord Dependency Audit

An analysis of places in `packages/activerecord/src/` where we reimplement
functionality inline instead of using sibling packages, or use raw SQL strings
instead of Arel AST nodes.

## 1. Raw SQL Strings Instead of Arel

These are places in high-level business logic that construct SQL via string
interpolation instead of using `@blazetrails/arel` (Table, SelectManager,
InsertManager, UpdateManager, DeleteManager, Nodes).

### relation.ts

| Lines      | Pattern                                                            | What It Does                                                         |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| ~277, ~317 | `"${sourceTable}"."${pk}" IN (SELECT ...)`                         | `whereAssociated` / `whereMissing` builds subquery as string         |
| ~2229–2326 | `INSERT INTO "${table.name}" (${colList}) VALUES ...`              | `insertAll` builds full INSERT (+ ON DUPLICATE KEY UPDATE) as string |
| ~2704      | `sql.replace(/^SELECT/, SELECT ${hints})`                          | Optimizer hints injected via regex replace on finished SQL           |
| ~3548      | `SELECT "${ownerFk}", "${targetFk}" FROM "${joinTable}" WHERE ...` | HABTM eager-load query built as string                               |
| ~3775      | `DELETE FROM "${table.name}" WHERE "${pk}" = ${quoted}`            | Single-record delete as raw SQL                                      |

### base.ts

| Lines               | Pattern                                                        | What It Does                                      |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| ~2008, ~2057, ~2062 | `UPDATE "${table.name}" SET "${attribute}" = COALESCE(...)`    | `increment` / `decrement` builds UPDATE as string |
| ~2707–2710          | `INSERT INTO "${table.name}" (${colList}) VALUES (${valList})` | `create` builds INSERT as string                  |
| ~2773               | `UPDATE ... SET ... WHERE ...`                                 | `updateAll` builds UPDATE as string               |
| ~2846, ~2915, ~2930 | `DELETE FROM "${table.name}" WHERE ...`                        | `destroy` / `delete` builds DELETE as string      |
| ~2942, ~2978        | `SELECT * FROM "${ctor.tableName}" WHERE ...`                  | `reload` builds SELECT as string                  |
| ~3202               | `UPDATE ...`                                                   | `save` builds UPDATE as string                    |

### nested-attributes.ts

| Lines | Pattern                                           | What It Does                                     |
| ----- | ------------------------------------------------- | ------------------------------------------------ |
| ~225  | `UPDATE "${tableName}" SET "${foreignKey}" = ...` | Updates foreign key after creating nested record |

### associations/join-dependency.ts

| Lines | Pattern                                 | What It Does                                           |
| ----- | --------------------------------------- | ------------------------------------------------------ |
| ~547  | `${throughJoinSql} LEFT OUTER JOIN ...` | Through-association join clause concatenated as string |

### internal-metadata.ts / schema-migration.ts / migration-runner.ts

These system-level files also use raw SQL for CREATE TABLE, SELECT, INSERT,
DELETE on internal tables (`schema_migrations`, `ar_internal_metadata`). Lower
priority since they're infrastructure, but Rails uses Arel here too.

---

## 2. Inline Inflection Instead of ActiveSupport

ActiveSupport exports: `pluralize`, `singularize`, `camelize`, `underscore`,
`classify`, `tableize`, `titleize`, `humanize`, `dasherize`, `foreignKey`, etc.

### relation.ts — reimplements functions it already imports

The file imports `underscore`, `camelize`, `singularize`, `pluralize` from
`@blazetrails/activesupport` at lines 9–13, but then defines local copies:

| Lines      | Function         | Notes                                |
| ---------- | ---------------- | ------------------------------------ |
| ~3059–3064 | `singularize()`  | Only handles basic `-ies`/`-s` cases |
| ~3065–3069 | `camelize()`     | Manual regex                         |
| ~3070–3074 | `underscore()`   | Manual regex                         |
| ~3075–3086 | `pluralize()`    | Only handles basic cases             |
| ~3316–3320 | `underscore()`   | Duplicate of above                   |
| ~3321–3325 | `camelize()`     | Duplicate of above                   |
| ~3326–3330 | `singularize()`  | Duplicate of above                   |
| ~3375–3386 | `pluralizeHot()` | Another inline pluralize             |

These are used in eager-loading association resolution. The imported functions
should be used directly.

### nested-attributes.ts — reimplements inflection from scratch

| Lines    | Function        | Notes                                     |
| -------- | --------------- | ----------------------------------------- |
| ~129–134 | `singularize()` | Incomplete: only `-ies` → `-y`, `-s` trim |
| ~135–139 | `camelize()`    | Manual regex                              |
| ~150–154 | `underscore()`  | Manual regex                              |

No import from activesupport exists in this file at all.

### delegated-type.ts

| Lines  | Pattern                                              | Should Use     |
| ------ | ---------------------------------------------------- | -------------- |
| ~82–83 | `lowerName.replace(/([A-Z])/g, "_$1").toLowerCase()` | `underscore()` |

### enum.ts

| Lines | Pattern                                             | Should Use                   |
| ----- | --------------------------------------------------- | ---------------------------- |
| ~92   | `s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())` | `camelize()`                 |
| ~103  | `charAt(0).toUpperCase() + slice(1)`                | `camelize()` or `classify()` |

### delegate.ts

| Lines  | Pattern                                            | Should Use   |
| ------ | -------------------------------------------------- | ------------ |
| ~25–26 | `method.charAt(0).toUpperCase() + method.slice(1)` | `camelize()` |

### reflection.ts — inconsistent: imports some, inlines others

The file imports `underscore`, `pluralize`, `singularize` from activesupport
(line 2), but still does manual capitalization:

| Lines    | Pattern                                                | Should Use                      |
| -------- | ------------------------------------------------------ | ------------------------------- |
| ~33, ~35 | `singular.charAt(0).toUpperCase() + singular.slice(1)` | `classify()` from activesupport |

---

## 3. ActiveSupport Utilities Not Used

ActiveSupport exports many utilities that activerecord reimplements or ignores.

### blank / present checks

| File                 | Lines    | Pattern                                                     | Should Use                  |
| -------------------- | -------- | ----------------------------------------------------------- | --------------------------- |
| attribute-methods.ts | ~38–42   | `value === null \|\| value === undefined` + `trim() === ""` | `isBlank()` / `isPresent()` |
| core.ts              | ~115–127 | `isPresent()` / `isBlank()` wrappers                        | `isBlank()` / `isPresent()` |

### Other available but unused ActiveSupport features

These are exported by activesupport and used by Rails' ActiveRecord but not
yet wired up in our implementation:

- **`HashWithIndifferentAccess`** — Rails uses this for attribute hashes
- **`Notifications`** — Rails instruments queries via `ActiveSupport::Notifications`
  (our `query-logs.ts` and instrumentation could use this)
- **`Duration` / `TimeZone` / `TimeWithZone`** — timezone-aware attribute handling
- **`MessageEncryptor` / `MessageVerifier`** — our `encryption/` directory has
  its own crypto; Rails delegates to ActiveSupport
- **`CurrentAttributes`** — Rails uses this for request-scoped state
- **`MemoryStore` / `FileStore`** — query cache could use ActiveSupport::Cache
- **`Logger` / `BroadcastLogger`** — our logging could use ActiveSupport::Logger

---

## 4. ActiveModel Integration Gaps

ActiveModel integration is generally good — validators extend base classes,
the type system is shared. A few gaps remain:

### Callbacks

| File         | Notes                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| callbacks.ts | Verify this delegates to `@blazetrails/activemodel` callback infrastructure rather than reimplementing |

### Dirty tracking

| File                       | Notes                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| attribute-methods/dirty.ts | Verify this uses `@blazetrails/activemodel`'s `DirtyTracker` / `AttributeMutationTracker` |

### Errors

| File      | Notes                                                                                         |
| --------- | --------------------------------------------------------------------------------------------- |
| errors.ts | Check whether AR errors delegate to `@blazetrails/activemodel`'s `Errors` class as Rails does |

---

## Priority Order

1. **relation.ts inline inflection** — Already imports the functions but doesn't
   use them. Pure waste + correctness risk (incomplete implementations).
2. **base.ts raw SQL** — Core CRUD operations should use Arel managers.
3. **relation.ts raw SQL** — Query building is Arel's entire purpose.
4. **nested-attributes.ts** — Both raw SQL and inline inflection.
5. **delegated-type.ts / enum.ts / delegate.ts / reflection.ts** — Inline
   string manipulation instead of activesupport.
6. **ActiveSupport utilities** (blank/present, notifications, encryption) —
   Alignment with how Rails wires its internals.
7. **ActiveModel integration verification** — Confirm callbacks, dirty, errors
   delegate properly.
