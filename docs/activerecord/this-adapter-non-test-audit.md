# `this.adapter = …` non-test audit

Classifies the non-`*.test.ts` `.ts` files that contain `this.adapter = …`
writes, to separate **D-1 bypass survivors** (test classes extending `Base`
that set `this.adapter` to skip the connection handler — the same pattern
PRs #2587 / #2589 just cleaned up) from **legitimate bound-adapter class
fields** on unrelated abstractions (e.g. `SchemaCreation`, `Registration`,
`MigrationRunner`), which must be left untouched.

## Classification rule

1. Does the containing class extend `Base` (or a `Base` subclass)?
   - **NO** → it's a separate `adapter` field on an unrelated class → **legit**.
   - **YES** → could be a bypass; check further.
2. If extending `Base`, is `this.adapter = …` used to bypass the connection
   handler (rather than a distinct typed field for another concept)?
   - **YES** → bypass survivor; migrate to `Base.connection` per the Phase-3 pattern.
   - **NO** → legit class field.
3. Edge case: a TEST class (extends `Base`, only constructed in tests) is a
   **bypass survivor** — that's exactly what the D-1 sweep targeted.

Litmus reference: `connection-adapters/abstract/schema-statements.ts` uses
`this.adapter` in ~101 places as a constructor-bound reference. It is **not**
a `Base` subclass, so the #2580 codemod correctly skipped it.

## Findings

### 1. `packages/activerecord/src/adapters/postgresql/schema-ar-models.ts`

- **Class(es):** `Thing1`, `Thing2`, `Thing3`, `Thing4`, `Thing5`,
  `SchemaThing`, `Song`, `Album` — all `extends Base`, built by factory
  functions for `schema.test.ts` / `schema-authorization.test.ts`.
- **Sites:** 32, 38, 44, 50, 61, 71, 89, 95 (8 sites)
- **Verdict:** **bypass survivor (needs migration)**
- **Rationale:** These are AR-model test fixtures that extend `Base` and pin
  `this.adapter = adapter` to skip the connection handler (edge case #3) — the
  same bypass shape PRs #2587/#2589 removed, just relocated into a fixture
  builder under `test-helpers`/`adapters`, so it survived the `*.test.ts`
  cleanup wave.

### 2. `packages/activerecord/src/type/adapter-specific-registry.ts`

- **Class:** `Registration` (no `extends`; `DecorationRegistration extends Registration`)
- **Sites:** 39
- **Verdict:** **legit class field (leave alone)**
- **Rationale:** `adapter?: string` is the _adapter-name_ a type registration
  is scoped to (e.g. `"postgresql"`), not a `DatabaseAdapter` connection, and
  the class is unrelated to `Base`.

### 3. `packages/activerecord/src/test-helpers/bootstrap-test-handler.ts`

- **Class:** none — the file is module-level functions
  (`bootstrapTestHandler`, `syncHandlerVisitor`).
- **Sites:** none (the only match, line 6, is a JSDoc comment _describing_ the
  `static { this.adapter = X }` bypass it exists to replace).
- **Verdict:** **legit (no write; leave alone)**
- **Rationale:** No `this.adapter` assignment exists; the file is the
  Phase-D handler-bootstrap helper that models migrate _toward_.

### 4. `packages/activerecord/src/migrator.ts`

- **Class:** `MigrationRunner` (no `extends`)
- **Sites:** 25
- **Verdict:** **legit class field (leave alone)**
- **Rationale:** `private adapter: DatabaseAdapter` is a constructor-bound
  reference on a standalone migration runner, not a `Base` subclass bypass.

### 5. `packages/activerecord/src/connection-adapters/abstract/schema-creation.ts`

- **Class:** `SchemaCreation` (no `extends`)
- **Sites:** 47
- **Verdict:** **legit class field (leave alone)**
- **Rationale:** `protected adapter: SchemaQuoter` is the quoter the SQL
  visitor uses; the class is a sibling abstraction to `SchemaStatements`, not a
  `Base` subclass — identical to the litmus-reference case the codemod skipped.

## Summary

| File                                              | Verdict             | Sites |
| ------------------------------------------------- | ------------------- | ----- |
| `adapters/postgresql/schema-ar-models.ts`         | **bypass survivor** | 8     |
| `type/adapter-specific-registry.ts`               | legit class field   | 1     |
| `test-helpers/bootstrap-test-handler.ts`          | legit (no write)    | 0     |
| `migrator.ts`                                     | legit class field   | 1     |
| `connection-adapters/abstract/schema-creation.ts` | legit class field   | 1     |

**Bypass-survivor sites remaining after the `*.test.ts` cleanup wave: 8**,
all in `schema-ar-models.ts`. Because that file is a fixture _builder_ (not a
`*.test.ts` file), the test-file sweep does not reach it; it needs a sized
follow-up PR to migrate its 8 factory-built `Base` subclasses off
`this.adapter = adapter` onto the `Base.connection` handler chain (the
`bootstrapTestHandler` pattern). **Not migrated here — doc only.**

The other 4 files (`adapter-specific-registry.ts`, `bootstrap-test-handler.ts`,
`migrator.ts`, `schema-creation.ts`) are legitimate bound-adapter fields on
non-`Base` abstractions (or carry no write at all) and should be **permanently
excluded** from future `this.adapter` bypass audits.
