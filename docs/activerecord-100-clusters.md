# ActiveRecord post-100% — Cluster details

**Companion to [`activerecord-100-plan.md`](activerecord-100-plan.md).** That doc is the live tracker (in-flight PRs, followups, story count). **This doc holds the per-cluster slot detail** — slot descriptions, LOC sizing, audit attribution, cross-cluster overlap notes.

A "cluster" here is a set of related work-PR slots that share an audit source, a file area, or a Rails-source surface. Each cluster has 1–11 slots; PRs target ~250 LOC each.

When picking a slot to spawn:

1. Check `activerecord-100-plan.md`'s In flight + Story count to see what's already moving and what's queued.
2. Find the matching cluster in this doc for slot details, sequencing, and overlap notes.
3. Read the relevant `audit-*` reference in the slot description; the audit ran with full Rails-source context and its inventory is the source of truth for the gap shape.

---

## Associations-autosave cluster — all 4 slots closed (#1558, #1574, #1577, #1584); 5-item fidelity bundle closed (#1678)

i18n tests un-skipped nominally — full I18n backend port still required for real translation pipeline.

**Post-#1678 followups (~45 LOC bundle):**

- ~30 LOC — Centralize-vs-Rails-dispatch decision for autosave validations. Two paths: (a) wire `klass.validate(validationName)` and remove inline child-validation loop in `validateAssociations` so only per-association methods drive it; or (b) delete dead `defineNonCyclicMethod` per-association methods and document `validateAssociations` as canonical dispatch.
- ~5 LOC — `_autosaveBelongsTo` line 643 still reads `assocRecord.changed` directly; should consult `changed_for_autosave?` (Rails line 549). #1678 fixed only autosaveHasOne.
- ~10 LOC — `save_has_one_association:487` parity: Rails uses `(autosave && record.changed_for_autosave?) || _record_changed?(reflection, record, primary_key_value)`. We only do the changedForAutosave half; `_record_changed?` (FK-changed / inverse-polymorphic-changed / will-save-change-to FK) is not implemented. Likely blocks some persisted-but-FK-dirty hasOne cases.

**Followups (~480 LOC) — small bundle (~50 LOC) shippable as one PR:**

- ~1 LOC (F) — `_AUTOSAVE_AROUND_SAVE_KEY` guard in `addAutosaveAssociationCallbacks` should be `Object.prototype.hasOwnProperty.call(model, _AUTOSAVE_AROUND_SAVE_KEY)`.
- ~10 LOC (C) — `defineAutosaveValidationCallbacks` should call `model.validate(validationName)` + `model.afterValidation(_ensureNoDuplicateErrors)`. Un-skips `cyclic autosaves do not add multiple validations`.
- ~10 LOC (C) — `_autosaveBelongsTo` should guard on `isStaleTarget()` (Rails `autosave_association.rb:538`).
- ~10 LOC (C) — `_autosaveBelongsTo` FK→null on `self` before destroying associated record on `marked_for_destruction` (Rails lines 544-547).
- ~15 LOC (C) — `autosaveHasOne` should use `changedForAutosave()` (already implemented) instead of `childRecord.changed`.

**Followups — separate PRs:**

- ~20 LOC (E) — `queryConstraintsList` returns `ctor.primaryKey` as a string array when `_queryConstraintsList` is unset but `ctor.primaryKey` is composite. Eliminates scalar-fallback workaround in `autosaveHasOne`.
- ~20 LOC (D) — Populate `nestedAttributesTarget` from `assignNestedAttributes` so `:nested_attributes_order` becomes functional (dead code in `nested-error.ts:48-52`).
- ~30 LOC (E) — Un-skip CPK `assign ids with belongs to cpk model` + companion: CPK-aware `setIds` (composite ID tuple support).
- ~40 LOC (D) — Remove `!isNewRecord && !changed` short-circuit in `validateAssociations` + add Rails `associated_errors` filter. Unchanged children with cached NestedErrors don't re-propagate today.
- ~50–80 LOC (E) — Un-skip 4 polymorphic-inverse tests: polymorphic inverse-of swap detection in `has-one-association.ts` + auto-detected `inverseOf`.
- ~80 LOC (D, gated on I18n full-message customize) — Rewrite the two "indexed errors should be properly translated" tests against a real I18n backend.
- ~150 LOC (D) — Collapse `validateAssociations` and per-reflection `validate*Association` callbacks into a single `add_autosave_association_callbacks` dispatch. Resolves structural duplication.

**Pre-existing divergences (notes, no action):**

- `_validateAssociationsFn` runs after `validationsIsValid` restores `_validationContext`; Rails runs inside `run_validations!` while context is live.
- `autosaveHasOne` uses `computePrimaryKey.call(record, reflection ?? assoc)`; Rails calls `compute_primary_key(reflection, record)`. Fallback critical for unnormalized `assoc.options`.
- `saveHasOneAssociation` relies on `defineNonCyclicMethod`'s `_alreadyCalled` instead of Rails' `record.autosaving_belongs_to_for?(inverse_association)`.
- `AssociationBuilderExtension` only fires for `autosave: true`; Rails fires for every association. Cyclic dedup needs manual call when `autosave` is not set.

## Associations-reflection cluster — all slots closed (#1571, #1580, #1582, #1670)

**Slot C residual followups (~30–80 LOC):**

- ~30–50 LOC — HABTM ThroughReflection wrap + `isNested` workaround removal (`reflection.ts:1338`). Blocked on auditing `push`/reload path in `CollectionProxy` and `association.ts` for `reflection.macro === "hasAndBelongsToMany"` branches that break when outer reflection becomes ThroughReflection. Start with `grep "macro === \"hasAndBelongsToMany\"\|isHasAndBelongsToMany"`.
- ~30 LOC — Deeply nested through-association resolution in `CollectionProxy._buildThroughScope` (through-a-through beyond one level). Not exercised by current tests.
- Pre-existing: `MacroReflection.computeClass` error message wording diverges from Rails' `Missing model class X for the Owner#assoc association.`

31 empty-stub tests with generic boilerplate annotation. **Impl is fundamentally complete**; gaps are fixture plumbing + test-body writing + 3 fixture-model gaps.

1. **Slot C residual** (~150 LOC) — Remaining Hotel/Department/Chef/CakeDesigner/DrinkDesigner fixture + `reflect on missing source association raise exception` un-skip.

3 const_missing/NameError tests → unported-list candidates (Ruby-only language semantics).

**Followups (~110 LOC bundle):**

- ~30–50 LOC (D) — HABTM builder registers a `HasAndBelongsToManyReflection`; Rails registers a `ThroughReflection`. Fix `has-and-belongs-to-many.ts:195–220` `_build`. Removes the `isNested()` workaround and may unblock through-chain tests.
- ~10 LOC (E) — Sweep remaining `resolveModel(className)` call-sites to use `resolveAssocClass(record, assocName, className)`: `loadHasOneThrough` fallback, `loadHabtm`, `processDependentAssociations` (×2), `updateCounterCaches` (×2), `buildHasOne`, `buildBelongsTo`.
- ~20 LOC (E) — `associations/builder/belongs-to.ts` counter-cache wiring (~line 95) uses raw `resolveModel(targetClassName)` — convert too.
- ~30 LOC (E) — Deeply nested through-association resolution in `CollectionProxy._buildThroughScope` (through-a-through chains beyond one level). Not exercised by tests today.
- Pre-existing deviation — `MacroReflection.computeClass` error message uses our format vs Rails' `Missing model class X for the Owner#assoc association.`

## MySQL schema cluster — all slots closed (#1468, #1635)

**Slot C followups (~45 LOC):**

- ~10 LOC — Extend `scripts/test-compare/extract-ts-tests.ts` to parse `it.skipIf(expr)("name", fn)` callable form. Unblocks recognition of `float limits` in `abstract_mysql_adapter/schema_test.rb` and any other `skipIf`-conditional tests.
- ~30–50 LOC — `MySQLAnsiQuotesTest` un-skip: adapter-level `setSessionVariable` (or expose `execute("SET SESSION sql_mode='ANSI_QUOTES'")` cleanly) plus a `reconnect!` test hook. Also touches parser/quoting path for double-quoted identifiers under ANSI_QUOTES. Add `lessons_students`/`students` schema for `foreign_keys` test (FK with `ON DELETE CASCADE`) and a `topics` table for `primary_key` test.
- ~5 LOC — `Mysql2Adapter.currentDatabase()` override (currently inherits abstract's empty `""`). Mirrors PG's impl at `postgresql-adapter.ts:4218`.

## PG interval cluster — all slots closed (#1637, #1687)

PG row reads route through `lookupCastTypeFromColumn` → `typeMap.fetch(1186)` → `Interval`. The row-read gap was closed implicitly by #1567 (`intervalstyle = iso_8601` per-connection makes PG return ISO 8601 strings parsed via `Duration.parse`); #1687 just un-skipped the tests after verifying.

**Remaining followup (~50 LOC, optional):** `splitPgDefault` cast-aware numeric→Duration for `pg_get_expr` bare numerics → verbose-format deserialize. **Note:** the "bare numeric" theory may itself be a misdiagnosis (per #1637 finding); verify against PG 17+ behavior first.

Slot B AVG aggregate typecast closed (#1567 verbose-format Interval serialize + AVG dispatch). Schema-default extraction closed (#1637 — bug was on the dump side: `Duration.toString()` returns total seconds collapsing the Duration through `cleanDefault`'s `String(raw)` path. The original "`pg_get_expr` returns bare numeric" theory was a misdiagnosis — `pg_get_expr` does honour `SET intervalstyle = iso_8601`).

**Followups (~85 LOC):**

- ~30–80 LOC — Row-read deserialization (Slot B remainder). `interval.test.ts > "interval type"` and `> "interval type cast from numeric"` still `.skip` — PG row reads don't route interval values through `Interval.castValue` during attribute materialization (reads back `null` instead of `Duration`). Likely in attribute-set materialization or postgresql/oid type-map result deserialization.
- ~50 LOC (low priority) — Refactor `SchemaDumper.columns()` to route `col.default` through `col.castType?.typeCastForSchema` when available; drop the `Duration` branch from `cleanDefault`. Closer Rails parity (Rails routes through `schema_default → type.deserialize → type.type_cast_for_schema`). Auto-handles any future type with lossy `toString()` (decimal, bytea, etc.).
- ~5 LOC (cosmetic) — Once `t.interval(...)` DSL helper exists, simplify the test regex to a single alternative.
- Sweep — remove other BLOCKED comments around the codebase referencing the now-disproven `pg_get_expr returns bare numeric` theory.

## PG long-tail cluster — all slots closed (#1498, #1508, #1515, #1543, #1553, #1562, #1585)

Slot D was a no-op (Rails geometric types are all `SpecializedString`; pass-through helpers already cover the surface).

Money slot (#1508) left 3 BLOCKED tests pointing at generic Relation gaps (not money-specific): `sum`/`pluck` typecast on SQL expressions + `updateAll` BigDecimal serialize. Fold into Relation cluster work.

**Followups (~390 LOC):**

- ~5 LOC (H) — Generalize `PostgreSQLAdapter.nativeType("datetime")` (~line 4066) to delegate to `this.nativeDatabaseTypes()["datetime"]` instead of `=== "timestamptz"` special-case. Closes divergence for custom `datetimeType`; private map duplicates `nativeDatabaseTypes()` and can drift.
- ~10 LOC (E) — `schema load scoped to schemas` un-skip (needs `schema-cache.ts` clear).
- ~20 LOC (E) — `schema dump scoped to schemas` un-skip: `enumTypes()` returns schema-qualified names for non-public schemas.
- ~20 LOC (F) — Wire `type_for_attribute(column).deserialize(value)` for returned column values; today raw number is written back (benign for integer IDENTITY).
- ~30 LOC (E) — Audit `pgColumn` usages (`bit`, `bitVarying`, `xml`, `hstore`, `inet`, `cidr`, `macaddr`, `ltree`, `tsvector`, `tsrange`, etc.) for `col.type ≠ SQL type` gap in `toSql()`. Override `toSql()` in `PgTableDefinition` or change `pgColumn` to store SQL type directly. Pre-existing; surfaced by Slot E.
- ~50 LOC (F) — PG-specific `fills auto populated columns on creation` test for single-PK IDENTITY (Rails `persistence_test.rb:87`).
- ~100–150 LOC (G) — IPv6 canonicalization in `parseIpAddr`: lowercase hex + RFC 5952 compression so `isChanged`/`serialize` match Ruby's `IPAddr#eql?`. Today preserves caller's text; spurious dirty marks possible on manually-constructed IPv6. PG normalizes on round-trip so DB-backed attributes unaffected. Inline expander/compressor required (no `node:net` — blocked by browser-compat).
- ~150 LOC (F) — Implement `Model._returningColumnsForInsert(connection)` mirroring Rails `model_schema.rb`. Calls `connection.returnValueAfterInsert?(col)` per column (needs `Column#autoPopulated?` + `AbstractAdapter#returnValueAfterInsert?`). Passes explicit `returning:` to `execInsert`. Fixes composite-PK IDENTITY columns not named `id` and handles `DEFAULT gen_random_uuid()`. Today `executeMutation` hardcodes `RETURNING id`. Remove `_performInsert` comment in `base.ts` once landed.

**Notes:**

- 3 stub tests in `cidr.test.ts` (`cidr column`, `cidr type cast`, `cidr invalid`) have no Rails source backing. Find counterparts or delete.
- Possible missing file: `adapters/postgresql/inet.test.ts` mirroring Rails' `inet_test.rb` (today inet is folded into `network.test.ts`).
- `type-registry.ts` now maps `inet`/`cidr` → `IPAddr`; any DX type tests asserting `string` need updates.
- `castValue` returns `null` for non-String/non-nil/non-IPAddr inputs (Rails passes through). Type-system constraint (`IPAddr | null` return).

## PG UUID residual cluster (~250 LOC, Slot B remaining)

- **Slot B** (~250 LOC) — Associations + UUID FK binding.

Plus: 1 test references "migration framework" gap — leave skipped with sharpened annotation.

## MySQL table-options cluster — both slots closed (#1535, #1565)

**Followups (~100 LOC bundle):**

- ~5 LOC — `extractSchemaQualifiedName` equivalent so `tableComment()` (and other `information_schema` queries) handle `schema.table` names. Pre-existing gap.
- ~10 LOC — `TableDefinition` constructor: treat `primaryKey === false` same as `id: false`; treat `primaryKey: "name"` as custom PK column name. `abstract/schema-definitions.ts`.
- ~15 LOC — `MigrationContext.createTable` `_columnMeta` composite-PK tracking: mark each column listed in `options?.primaryKey` (array form) as `primaryKey: true` in `meta`. SchemaDumper reading in-memory MigrationContext source won't detect composite PKs today.
- ~15 LOC — `tableCollationCache` lazy population via `SHOW TABLE STATUS LIKE ...` (Rails' `schema_collation` path). Low priority — only matters for tables with implicit collation.
- ~25 LOC — Composite PK column order divergence: `schema-dumper.ts:emitTable` uses declaration order from `SHOW FULL FIELDS`; Rails uses `@connection.primary_key(table)` (`seq_in_index` order). Override in `mysql/schema-dumper.ts`.
- ~30 LOC — Override `createTableDefinition` in `AbstractMysqlAdapter` to return a `MySQL::TableDefinition` (charset/collation in constructor). Both DDL paths produce the same output via `toSql()` today, but cleaner.

## MySQL charset-collation cluster — Slot A in flight (#1591), Slot B + B-followups closed (#1533, #1568)

1. **Slot A** (~120–180 LOC, in flight #1591) — `createTable` `id` hash form `{ type, collation, ... }` + `ColumnOptions.charset` + "add column with charset and collation" test. Bundles ~15 LOC `mysql/schema-definitions.ts` stubs (`validColumnDefinitionOptions`, `aliasedTypes`, `integerLikePrimaryKeyType`).
2. **Slot C** (~15 LOC, optional) — BLOCKED annotation cleanup.

**Followup carry-over (~150 LOC):**

- ~150 LOC — Targeted SQL-fragment unit tests for the 4 #1568 helpers (DROP-vs-SET default fragment, undefined→null normalization at both sites, NULL-backfill UPDATE shape, comment-clearing). `abstract-mysql-adapter.test.ts` is live-DB only.

Adjacent gap: `abstract-mysql-adapter.ts` `buildCreateIndexDefinition` is also a stub returning `{}`. Not part of charset-collation but worth knowing for whoever picks up Slot A or B-followup.

## Relation cluster — Slots A, B, C, D, E, G closed; F dropped; H remains

302 skipped tests across ~14 relation-area files. Closed: A (#1511), B (#1537), C (#1542), D (#1541), E (#1575), G (#1588). Slot F (load_async scheduling) dropped — sources unported; 28 affected tests permanent-skipped.

1. **Slot H** (~220 LOC) — Relation misc small-surface bundle.

**Followups (~430 LOC across closed slots):**

Test-body bundle (~155 LOC, mostly fixture/port work):

- ~30 LOC (E) — Port `find in batches should not error if config overridden` + `should error on config specified to error` test bodies.
- ~50–80 LOC (G) — Un-skip `registering new handlers for joins`: scoped association where-clause expansion should propagate custom handlers into the lambda's evaluation context.
- ~50 LOC (E) — Port 7 remaining test bodies: Subscriber fixture, PostWithDefaultScope, `assertQueriesMatch` infra, table-alias path.
- ~100 LOC (B) — Polymorphic test bodies for 7 wired-but-skipped tests in `where.test.ts` (~lines 1014–1073, 1962). Fixture work, not impl.

Core gaps bundle (~145 LOC, smaller fidelity fixes):

- ~5 LOC (C) — Tighten `isPolymorphicClause` parameter type + fallback when `whereValuesHash` is absent.
- ~10 LOC (E) — Add `this.attribute("id", "integer")` to CPK test models to fix `id` hydration; un-skips 2 CPK start/finish tests.
- ~10 LOC (E) — `inBatches` should branch on `this._loaded` and call `_batchOnLoadedRelation`; helper exists, unwired.
- ~10 LOC (E) — `cursor` uniqueness validation: `ensureValidOptionsForBatchingBang` needs schema-cache access for PK/unique-index check.
- ~10 LOC (E) — `inBatches({ load: true })` should set batch order on yielded `batchRel`.
- ~10 LOC (D) — `defaultScopeOverride` detection for static-method form (no test coverage today).
- ~15 LOC (C) — `whereAssociated`/`whereMissing` for composite PKs (currently throws in `_resolveAssociationTarget`).
- ~15 LOC (E) — Implement `remaining` limit cap in `batchOnUnloadedRelation` (pass `limitValue` through); `.limit(N).inBatches(...)` returns too many today.
- ~20 LOC (C) — Enum/scoped association support in `whereAssociated`/`whereMissing` for 10 remaining enum tests.
- ~20 LOC (D) — Wire `buildDefaultConstraint` into `_deleteRecord`/`_updateRecord` so `allQueries: true` adds WHERE on writes (defined-but-never-called today).
- ~30 LOC (E) — Implement `useRanges` range-optimization (Rails `WHERE id >= x AND id <= y` mode); re-expose the option.

Larger refactors:

- ~30 LOC (B) — CPK `AssociationQueryValue.queries()` Relation path still throws. Pragmatic deviation: subquery approach (same as non-CPK Relations).

**Pre-existing deviations (notes):**

- `where({assocName: {...}})` produces `"pbTopic2"."title"` (SQL alias from `associatedTable(key)`) instead of Rails' `"topics"."title"`. Alias correct for joined queries, wrong for standalone where.
- `Base.predicateBuilder` (via `core.ts`) creates bare `PredicateBuilder(table)` without `_tableContext`. Direct `Model.predicateBuilder.buildFromHash(...)` misses associated-table expansion. Fix: `core.ts predicateBuilder()` should call `pb.setTableContext(new TableMetadata(this, this.arelTable))`.
- `exceptPredicates` filters at column-level (`"table.column"` string match); Rails filters at table-level. Functionally equivalent for common cases; Rails also filters stray `IS NOT NULL` predicates.
- `deriveFkQueryConstraints` raises `ConfigurationError` (Rails raises `ArgumentError`); conscious divergence.
- EachTest2 CPK placeholder stubs pass trivially without exercising behavior — needs sharpened annotations.

## Associations-core cluster — A, B, C, D, A-preloader-grouping closed (#1538, #1557, #1566, #1590, #1674); E remains

**Slot A preloader-grouping followups (~430 LOC across multiple slots, ~10 tests remain post-#1674):**

- ~30 LOC — Un-skip `preload groups queries with same sql at second level` once an `extending` association option lands (test body otherwise ready).
- ~60 LOC — Un-skip `preload can group separate levels` with 3-query assertion (impl correct; needs body restored).
- ~40 LOC — Postesque fixture for `does not group same scope different key name` (needs different `joinPrimaryKey` to actually exercise the distinction).
- ~80–120 LOC — STI/through `available_records` bundle (5 tests skipped): `sti`, `with through association`, `only some records available with through`, `available records queries when scoped/collection/incomplete`. Needs test bodies + STI lookup fix.
- ~120 LOC — Composite-FK preload bundle (3 tests skipped): `has many association with composite foreign key`, `belongs to ... composite foreign key`, `loaded belongs to ... composite foreign key`, `has many through with composite query constraints`. Loader infra supports `string[]`; needs CPK fixtures.
- ~150 LOC — `preload can group multi level ping pong through` — large fixture (similar_posts + favorite_authors); deferred slot.

Closed: A (#1538), B (#1557), C (#1566), D (#1590). 49 original placeholder stubs in `associations.test.ts`. Many remain — categorized below for routing.

**Remaining 35 skipped tests in `associations.test.ts` (post-#1590):**

- 5 — autosave (save-on-parent-saves-children, composite-FK autosave)
- 4 — `inverseOf` population on collection load
- 14 — preloader grouping (same-scope batching) → Slot A territory
- 8 — `queryConstraints` feature
- 4 — not applicable in JS (`inspect`/`pretty_print`, Mocha stub infra) → permanent-skip candidates

**Followups (~390 LOC across closed slots):**

Test-body bundle (~70 LOC):

- ~20 LOC (C) — 2 "extensions" test bodies in `eager.test.ts` (extensions + instance dependent scope). Infra in place; needs models + assertions.
- ~30 LOC (B) — "preloads model with query_constraints by explicitly configured fk and pk" test body. Likely works; needs inline fixture.
- ~20 LOC (D, gated on query-cache landing) — Update `reload with query cache` test bodies.

Smaller fidelity (~50 LOC bundle):

- ~5 LOC (A) — Add connection/adapter identity to `LoaderQuery.hashKey()` for multi-DB grouping isolation.
- ~40 LOC (D) — Upgrade remaining size/empty stubs in `has-many-associations.test.ts` (lines ~1691–1791).

Larger refactors:

- ~30–50 LOC (B) — `AssociationQueryValue.convertToId` array-PK branch: handle composite `primaryKey` when value is a record instance. Currently throws. Unblocks 2 "querying by whole/single associated records" tests.
- ~50–80 LOC (B) — Polymorphic belongs_to `query_constraints`: WHERE clause must add owner's shared key alongside scalar `parent_id` in `loadBelongsTo` polymorphic path.
- ~80–120 LOC (B) — Fixture-dependent composite-FK autosave/through tests (append/assign composite has-many w/ autosave; nullify composite has-many-through).
- ~80–120 LOC (C) — Implement `Relation#includes!`/`Relation#references!` infra for Rails-faithful `through_scope` path. Today source-layer filtering compensates (semantically correct, all tests pass) but diverges for through-gated records with multiple source children.

**Pre-existing notes:**

- `_valuesForQueries()` falls back to `JSON.stringify(scope.valuesForQueries())` — stable for simple scopes; not yet stress-tested for complex predicates.
- `has-many-association.ts` `deleteRecords` uses `reflection.klass.composite_query_constraints_list`; our `compositeQueryConstraintsList` wiring may differ.
- `isNone()` delegates to `count() === 0`; Rails `empty?` checks `target.empty?` first (avoids query if unsaved in-memory records exist).

**Remaining 35 skipped tests in `associations.test.ts` (categorized for routing):**

- 5 tests — autosave (save-on-parent-saves-children, composite-FK autosave)
- 4 tests — `inverseOf` population on collection load
- 14 tests — preloader grouping (same-scope batching) → Slot A territory
- 8 tests — `queryConstraints` feature
- 4 tests — not applicable in JS (`inspect`/`pretty_print`, Mocha stub infra) → permanent-skip candidates

3. **Slot E** (~30 LOC, optional) — Annotation re-keying.

## Associations has-many-through cluster — all slots closed (#1573, #1593, #1646, #1656, #1661)

**Slot E followups (~150–230 LOC):**

- ~80–150 LOC — JoinDependency alias resolution for nested-through. `Author.joins(:nested_through).where("far_table.col" => v)` emits FK on wrong intermediate table; closes 2–3 skipped tests in `nested-through-associations.test.ts` (lines 1119, 1610, 1689).
- ~40–80 LOC — `sourceType` + user-`scope` on nested-through where `through:` is itself through with polymorphic source. Scope binds to wrong table; needs Rails-style scope-attachment to specific reflection in chain.
- ~30 LOC — Verify `distinct` propagation on nested-through `loadHasManyThrough` — DB pre-dedupes via `WHERE id IN`, so the assertion may not exercise the actual `SELECT DISTINCT` path.

**Slot D followups (~60 LOC):**

- ~30 LOC — Rails-mirrored test for `Author.joins(:ratings).where("ratings.value": N)` against nested-through chain (verifies JoinDependency, not preloader). Belongs in Slot E (intermediate-join SQL through nested chains was deliberately punted).
- ~20 LOC — `source_type` polymorphic-with-sourceType variant of nested-through preload test. Preloader already filters `foreignType === sourceType` but no test pins the intersection. Slot E territory.
- ~10 LOC — `_dataAvailable()` / `runnableLoaders()` in `preloader/through-association.ts` only checks single source preloader layer. For 4+ level chains, runnable-loader scheduling may emit one extra wasted pass (perf, not correctness).
- Pre-existing notes: Slot D shipped ~200 LOC vs ~270 sized — `ThroughAssociation` preloader + `Reflection#chain` walker already handled nested-through end-to-end. Tests use local `Ntd*` model prefixes (not Rails fixtures), descriptive English names (not Rails `test_has_many_through_*`); `test:compare` won't match by name (Δ 0).

33 skipped across 3 files — most are empty placeholders awaiting Rails-mirrored bodies. Production code surface (`has-many-through-association.ts`, `through-association.ts`, `disable-joins-association-scope.ts`) is structurally complete.

**Slot C followups (~210 LOC):**

- ~80 LOC — Constructor-form collection writer in `_assignAttributes` (`attribute-assignment.ts:27`): detect when a key matches an association name (via `ctor._associations`) and dispatch to `setHasMany`/`setHasOne`/collection writer instead of `writeAttribute`. Unblocks `new Owner({items: [...]})` Rails pattern across HMT/HABTM/HasMany.
- ~30 LOC — `association.reset_scope` on owner save. Add a no-op `resetScope()` on Association + invoke from `saveCollectionAssociation` before iterating children. Required for scoped through associations whose target needs re-resolution.
- ~100 LOC — HMT `insert_record` two-step alignment. Replace `insertHabtmRecord`'s single-row write with Rails' two-step (super.insertRecord → `save_through_record`). Risk: HABTM tests not validating through-target may break; recommend behind HABTM Slot E (polymorphic + STI through).
- Pre-existing: `marshal_dump_7_1` equivalent skipped (Ruby Marshal only); if JS structured-clone path is ever ported, the "exclusion" semantics (unloaded associations, association cache state) become real work.
- Pre-existing: `autosave: false` opt-out path skips inserts but Rails always runs `association.reset_scope` unconditionally — latent gap (covered by `resetScope` followup above).

2. **Slot D** (~270 LOC) — Nested-through preloader + STI + joins/includes.
3. **Slot E** (~260 LOC) — Nested-through advanced (distinct/repeated table/polymorphic-with-scope/source-reset/autosave-skip).

Note: audit worktree didn't have rails source populated (historical path was `scripts/api-compare/.rails-source/`; now `vendor/rails/`) → slots sized by test-name-family inference rather than line-by-line Rails read. Workers picking these up should re-validate against `vendor/rails/` once spawned (run `pnpm vendor:fetch` to populate).

**Followups (~140 LOC across A+B):**

- ~30–50 LOC (A) — `foreignKey` option on `has_many :through` is ignored in `ThroughReflection.joinPrimaryKey` (`reflection.ts:1205`). Rails uses `delegate_reflection` exclusively; ours falls back to it only when sourceReflection is missing. Fix so `delegateReflection.foreignKey` wins when set.
- ~30 LOC (B) — Regular (JOIN-based) `djMembersOrdered` / `djMembersDouble` produce wrong/unordered results when chaining `.where()` or `.reorder()`. Add assertions once `_buildThroughScope` is fixed.
- ~80–120 LOC (B) — Fix `CollectionProxy._buildThroughScope()` for nested-through associations (where `through` target is itself a through). Today applies WHERE on intermediate through model directly, which lacks the FK column. Option B (preferred): initialize CollectionProxy seed from `DisableJoinsAssociationScope` (deferred DJAR) so `.where()` chaining produces correct DJAS-based SQL. Tests 2–11 use `djasScope()` workaround; `.where()` on a CollectionProxy for nested-through DJ still fails at runtime for users.

**Notes:**

- No `assert_queries_count` equivalent → disable-joins efficiency guarantees aren't tested.
- `QueryMethodsHost._reordering` is `boolean` but only set to `true` in `reorderBang`. Consider resetting to `false` in `orderBang` for completeness.

<<<<<<< Updated upstream

## Associations-HABTM cluster (~1690 LOC across 9 slots, from audit-associations-habtm)

||||||| Stash base

## Associations-HABTM cluster — Slots A + B closed (#1597, #1609); C–I remain (~1290 LOC across 7 slots)

=======

## Associations-HABTM cluster — all slots closed (#1597, #1609, #1645, #1652, #1657, #1660, #1666, #1672, #1681)

**Slot F followups (~100 LOC):**

- ~20 LOC — Align HABTM `primaryKey` behavior: `loadHabtm`/`habtmOwnerPk` honors `options.primaryKey` but JoinDependency eager-load passes `modelClass.primaryKey`. Rails macro intentionally doesn't forward `:primary_key` (allowlist `associations.rb:1900`). Recommend dropping `habtmOwnerPk` primaryKey override (option b) for Rails fidelity.
- ~30 LOC — Real-table-name reuse in `_addThroughAssociation`: mirror collision-check from `addAssociation` (lines 216-217) so user `.where("target_table.col")` predicates work on through eager loads. Affects all through associations, not HABTM-specific.
- ~50 LOC — Schema-qualified HABTM tables (`"schema.table"` → `"schema"."table"`) — confirm via dedicated test using `makeSongAlbumModels`-style.

**Slot H followups (~200 LOC):**

- ~50 LOC — Wire `associationForeignKey` end-to-end through `createHabtmJoinModel` (target FK on right belongs_to) and `_resolveHabtmJoin`/`loadHabtm`. Today hardcoded as `${underscore(singularize(name))}_id`.
- ~30 LOC — Pass `options.foreignKey` into middle reflection options so public HABTM no longer needs join-key options leak.
- ~80 LOC — Wire `destroyAssociations` stub in `persistence.ts:1221` into the destroy flow (call from `persistence.destroy()` before `_destroyRow`, mirroring Rails `persistence.rb:455`). Then refactor HABTM `beforeDestroy` to `destroy_associations` override module.
- ~40 LOC — Produce distinct hasMany-through reflection for public name (Rails' `has_many name, **hm_options` at end of `has_and_belongs_to_many`). Lets `_reflections[name]` be the through-hasMany and HABTM reflection be parent link only.

**Slot I followups (~40 LOC):**

- ~40 LOC — Centralize scope_for_create on base `Association#initializeAttributes`: read `scope_for_create`, filter by `record.changedAttributeNamesToSave` minus `skipAssign` keys, `_assignAttributes`. Closes 2 deviations (already-assigned filter source + STI `type` column protection) + singular gap (`SingularAssociation#build`/`_createRecord` don't apply scope_for_create today).

**Pre-existing notes:** HABTM ThroughReflection-wrap still open from #1570 followup (`Reflection#isNested` workaround); blocked on auditing `push`/reload path for `reflection.macro === "hasAndBelongsToMany"` branches.

**Slot E followups (~110 LOC):**

- ~30–80 LOC — Preloader already-loaded-through + polymorphic-sourceType empty-result gap (`preloader/through-association.ts:56-71`). When through assoc already loaded on owner, polymorphic-sourceType preload yields empty source records. Reproducer: Hotel → Departments → Chefs → employable[CakeDesigner]; preload `psChefs` first, then `cakeDesigners`.
- ~50 LOC — Single-through (non-nested) polymorphic+sourceType test variant covering `AssociationScope` direct JOIN path (`Department has_many cake_designers through: chefs, source: employable, source_type: "PsCakeDesigner"`).
- ~30 LOC — Normalize/unblock 12 `it.skip` stubs in `nested-through-associations.test.ts` tagged `BLOCKED: associations — nested-attributes feature gap` (most look implementable; misleading annotation).

**Slot D followups (~140 LOC):**

- ~50 LOC — Wire `defineAutosaveValidationCallbacks` unconditionally on HABTM reflections at declaration time (currently gated by `options.autosave` at `associations.ts:340-343`). Un-skips two `validate: false … callbacks` tests in `has-and-belongs-to-many-associations.test.ts`.
- ~30 LOC — Add `parent_reflection` field to MiddleReflection / target hasMany reflection in HABTM builder (Rails `associations.rb:1884, 1905`); affects introspection, error messages, scope corner cases.
- ~20 LOC — Tighten `habtmOptions → middle hasMany` to Rails' explicit allowlist (`:before_add`, `:after_add`, `:before_remove`, `:after_remove`, `:autosave`, `:validate`, `:join_table`, `:class_name`, `:extend`, `:strict_loading`); drop leakage of `readonly`/`dependent`/`inverseOf`.
- ~40 LOC — Move HABTM `beforeDestroy` into anonymous `destroy_associations` override mixin (Rails-shape; composes with subclass overrides).

**Slot G followups (~50 LOC):**

- ~30 LOC — Apply copy-on-write Set semantics to `_counterCacheColumns` in `belongs-to.ts:78-81` and `counter-cache.ts:222-236`. Pre-existing parallel STI-inheritance bug.
- ~20 LOC — Write body for `counter-cache.test.ts:1134` (has_many :through counter cache) — empty stub today, likely passes with registry-driven `counterCachedAssociationNames`. Verify Rails source mapping first (test name doesn't match a Rails test directly; may need `normalize-skips` rename).
- ~50 LOC — Triage 14 other `BLOCKED: associations — counter cache not fully implemented` stubs in `counter-cache.test.ts` (lines 416, 643, 701, 707, 1213, 1381–1493); several likely unblock with the registry.
  > > > > > > > Stashed changes

**Important: ~160 of 168 BLOCKED tests are NOT HABTM-specific** — they exercise general associations machinery (`CollectionProxy` mutation, `*_ids` reader/writer, association scope chain composition, eager loading, polymorphic-through, STI-through, etc.). **Significant overlap with audit-associations-core cluster.** The HABTM builder itself is structurally complete.

<<<<<<< Updated upstream

1. **Slot A** (~260 LOC) — HABTM CollectionProxy mutation (`<<`, `push`, `delete`, `clear`, `concat`, `replace`) + `AssociationTypeMismatch`.
2. **Slot B** (~140 LOC) — `*_ids` reader/writer + ids cache invalidation.
3. **Slot C** (~250 LOC) — Association scope chain composition for HABTM (where/order/select/group/having/unscope).
4. **Slot D** (~150 LOC) — Association options: `validate:`, `readonly:`, `extend:`.
5. **Slot E** (~280 LOC, biggest payoff) — Polymorphic + STI through.
6. **Slot F** (~200 LOC) — Eager loading through HABTM (`includes`/`preload`/`eager_load`).
7. **Slot G** (~120 LOC) — Counter-cache install on `belongs_to` + through.
8. **Slot H** (~140 LOC, low priority) — HABTM builder polish.
9. **Slot I** (~150 LOC) — `build`/`create` on HABTM with scope-attr inheritance.
   ||||||| Stash base
   **Slot A followups (~140 LOC):**

- ~60 LOC (D) — `readonly: true` HABTM option to mark all loaded records as `ReadOnlyRecord` (raises on `save!`). Scope: `collection-proxy.ts` `loadTarget` + `_buildThroughScope` + readonly propagation. Un-skips `dynamic find all should respect readonly access`.
- ~80 LOC (D) — `validate: false` on push/create path to suppress validation callbacks on the pushed record. Scope: `collection-proxy.ts` push + `_pushThrough`. Un-skips `association with validate false does not run associated validation callbacks on create/update`.
- ~10 LOC — Wire `_raiseOnTypeMismatch` into `appendBang` → `_pushThrough` path; bang path bypasses type-check today.
- ~10 LOC — Type guard at top of `isInclude` (`return false unless record instanceof klass`) for Rails parity (TS generics make low-risk).
- ~30 LOC — `include_in_memory?` through-chain walk for through associations; currently uses `_target.includes(record)` fallback which misses records reachable only via join chain.

1. **Slot C** (~250 LOC) — Association scope chain composition for HABTM (where/order/select/group/having/unscope).
2. **Slot D** (~150 LOC) — Association options: `validate:`, `readonly:`, `extend:` (now also absorbs Slot A `readonly`/`validate` followups above).
3. **Slot E** (~280 LOC, biggest payoff) — Polymorphic + STI through.
4. **Slot F** (~200 LOC) — Eager loading through HABTM (`includes`/`preload`/`eager_load`).
5. **Slot G** (~120 LOC) — Counter-cache install on `belongs_to` + through.
6. **Slot H** (~140 LOC, low priority) — HABTM builder polish.
7. **Slot I** (~150 LOC) — `build`/`create` on HABTM with scope-attr inheritance.

**Slot B followups (~25 LOC):**

- ~20 LOC — `insertHabtmRecord` uses `throughModel.insertAll([joinAttrs])` which bypasses validation; Rails' `habtm_writer` uses `record.save(validate: validate)`. Wire `validate` through if needed (no real validators on HABTM joins in practice).
- Sweep — verify `_associationIds` cache invalidation on `destroyAll` and explicit `clear()` (Copilot raised; only `deleteAll` was wired exhaustively).
- # Pre-existing: `transaction()` HABTM bypass in `collection-association.ts` is a symptom fix; root cause is `_transactionFallback` vs `TransactionManager` savepoint counter collision (`active_record_N` duplicates on MySQL/MariaDB). Broader transaction-infra gap, not HABTM-specific.

  **Slot A followups (~140 LOC):**

- ~60 LOC (D) — `readonly: true` HABTM option to mark all loaded records as `ReadOnlyRecord` (raises on `save!`). Scope: `collection-proxy.ts` `loadTarget` + `_buildThroughScope` + readonly propagation. Un-skips `dynamic find all should respect readonly access`.
- ~80 LOC (D) — `validate: false` on push/create path to suppress validation callbacks on the pushed record. Scope: `collection-proxy.ts` push + `_pushThrough`. Un-skips `association with validate false does not run associated validation callbacks on create/update`.
- ~10 LOC — Wire `_raiseOnTypeMismatch` into `appendBang` → `_pushThrough` path; bang path bypasses type-check today.
- ~10 LOC — Type guard at top of `isInclude` (`return false unless record instanceof klass`) for Rails parity (TS generics make low-risk).
- ~30 LOC — `include_in_memory?` through-chain walk for through associations; currently uses `_target.includes(record)` fallback which misses records reachable only via join chain.

**Slot C followups (~70 LOC) — cross-cutting cleanup affecting ALL association loaders:**

- ~20 LOC — `applyAssociationScope(rel, scope, owner)` helper that handles arity (0-arity uses `this = rel`; 1-arity gets `rel`; 2-arity `(rel, owner)`) + falsy-return fallback. Swap 6 call sites: `loadHabtm` (associations.ts ~1543), `loadHasMany` (1067), `loadHasOne` (854), `loadHasManyThrough` (1187, 1303, 1320). `AssociationOptions.scope`'s `owner` parameter is currently dead.
- ~50 LOC — `Associations.hasAndBelongsToMany` builder-time `scope` (captured in `habtmOptions` but never reapplied) → wire into the reflection so `loadHabtm` auto-applies. Natural Slot D followup.

**Pending sweep:** Re-tag mis-labeled `BLOCKED: habtm` tests across `has-and-belongs-to-many-associations.test.ts`, `eager.test.ts`, `nested-through-associations.test.ts`, `extension.test.ts`, `inner-join-association.test.ts`, `has-many-associations.test.ts` (mirror #1641's STI annotation drift workflow). 3 known stubs need Slot D/A territory: `scoped find on through association doesnt return read only records` (readonly flag propagation through CollectionProxy), `attributes are being set when initialized from habtm association with where clause` + multi-condition variant (`scope_attributes` on `build()`/`new()`). 2. **Slot D** (~150 LOC) — Association options: `validate:`, `readonly:`, `extend:` (now also absorbs Slot A `readonly`/`validate` followups above). 3. **Slot E** (~280 LOC, biggest payoff) — Polymorphic + STI through. 4. **Slot F** (~200 LOC) — Eager loading through HABTM (`includes`/`preload`/`eager_load`). 5. **Slot G** (~120 LOC) — Counter-cache install on `belongs_to` + through. 6. **Slot H** (~140 LOC, low priority) — HABTM builder polish. 7. **Slot I** (~150 LOC) — `build`/`create` on HABTM with scope-attr inheritance.

**Slot B followups (~25 LOC):**

- ~20 LOC — `insertHabtmRecord` uses `throughModel.insertAll([joinAttrs])` which bypasses validation; Rails' `habtm_writer` uses `record.save(validate: validate)`. Wire `validate` through if needed (no real validators on HABTM joins in practice).
- Sweep — verify `_associationIds` cache invalidation on `destroyAll` and explicit `clear()` (Copilot raised; only `deleteAll` was wired exhaustively).
- Pre-existing: `transaction()` HABTM bypass in `collection-association.ts` is a symptom fix; root cause is `_transactionFallback` vs `TransactionManager` savepoint counter collision (`active_record_N` duplicates on MySQL/MariaDB). Broader transaction-infra gap, not HABTM-specific.
  > > > > > > > Stashed changes

**Annotation drift sweep needed first** — ~160 of these are mis-tagged as `BLOCKED: habtm` when the real cause is general-associations machinery.

## Migration cluster — Slots B, C, E closed (#1505, #1554, #1569); D, F remain

1. **Slot D** (~250 LOC) — Multi-DB `MigrationContext` factory. 7 un-skips.
2. **Slot F** (~180 LOC, in flight #1598) — Bulk-alter recorder round-trip + `change-column` test reorg. 6 un-skips.

**Followups (~200 LOC bundle across B/C/E):**

Small fidelity bundle (~50 LOC):

- ~5 LOC (C) — `MigrationProxy` interface: add `scope?: string` field (Rails `MigrationProxy = Struct.new(:name, :version, :filename, :scope)`). Unblocks Slot D engine-migration support.
- ~5 LOC (B) — `TableDefinition.toSql()` default switch reject empty/whitespace column types upfront (silent pass-through today).
- ~10 LOC (E) — Document `InternalMetadata#tableExists()` short-circuit deviation with `@internal`: returns `false` when `_enabled` is false even if physical table exists (Rails always queries `pool.schema_cache.data_source_exists?`).
- ~10 LOC (B) — Forward `currentDatabase()` + advisory-lock helpers from `SchemaAdapter` to inner adapter in test-adapter.ts. Unblocks advisory-lock test.
- ~20 LOC (B/C) — Unify `MigrationContext.tableNamePrefix`/`tableNameSuffix` two-sources-of-truth (instance fields vs `_arConfig` registry).

Larger items (each its own PR):

- ~20 LOC (E) — `MigrationContext.fromPath(dir)` factory wrapping `migrationFiles` + `parseMigrationFilename` + camelize → `MigrationProxy[]` (mirrors Rails `MigrationContext#migrations`).
- ~30 LOC (B) — CTAS `_introspectColumns` returns name-only; `_columnMeta` stored as `{type:"string"}` for any CREATE TABLE AS column. Wrong type metadata downstream of any CTAS.
- ~30 LOC (E) — `migrationsStatus()` should emit `{status:"up", version, name:"********** NO FILE **********"}` entries for schema_migrations versions absent from `this._migrations`. Unblocks "migrations status in subdirectories".
- ~50 LOC (B) — Extend prefix/suffix regression coverage to `removeColumn`, `add/removeIndex`, `add/removeForeignKey`, `add/removeCheckConstraint`, `add/removeReference`, `create/dropJoinTable`, `changeColumn*`, `renameIndex`, inspection helpers, comment helpers.

**Note:** `base.ts` now has top-level side-effect import of `migration.ts` via `registerMigrationArConfig`. Tree-shaking impact for browser bundles probably nil (Base loads most of migration.ts transitively) but worth re-verifying in BC plan revisit.

## Connection-pool cluster — all slots closed (#1556, #1570, #1587)

Slot D was 2 notification un-skips. Gap 8 (process-fork lifecycle) was a phantom — `connection_pool_test.rb` has no fork/PID test.

**Slot C-b deferred un-skips (~265 LOC + ~55 LOC shard-keys):**

- ~20 LOC — `retrieves proper connection with nested connected to`: nested shard switching via `connectsTo` pools.
- ~20 LOC — `loading relations with multi db connections`: multi-db.test.ts (AR model + lazy Relation across roles).
- ~25 LOC — `calling connected to on a non existent shard raises` ×3: needs `connectsTo` + `connectionPool()` error path.
- ~25 LOC — `shard-keys.test.ts` 3 unblocked (`connects to sets shard keys`, `for descendents`, `sharded?`).
- ~30 LOC — `connectedToAllShards()` ×3 (needs real pools).
- ~30 LOC — `establish connection using 3 levels config` (sharding file): `shards:` form + pool-name assertions.
- ~35 LOC — `establish connection using 3 levels config with shards and replica`: 4-pool variant.
- ~40 LOC — `same shards across clusters`: multi-class per-shard DB isolation with real DDL/DML.
- ~40 LOC — `sharding separation`: per-shard `:memory:` isolation with DDL/DML.
- 3 GVL-blocked thread tests → permanent-skip candidates for `unported-files.ts`.

**Smaller fidelity bundle (~40 LOC across B + C):**

- ~3 LOC (C) — `connectingTo` shard default should use `this.defaultShard()` instead of hardcoded `"default"`. Affects classes with non-default first shard from `connectsTo`.
- ~5 LOC (B) — Friendlier error when `Base.configurations` is non-standard object without `toH`: today silently resolves to empty configs then `AdapterNotSpecified`.
- ~10 LOC (B) — Track `defaultShard` on the class inside `connectsTo` (`self.default_shard = shards.keys.first`). Today `currentShard` falls back to `"default"`; matches Rails only when first shard key is `"default"`.
- ~15 LOC (B) — `connectsTo` should call Rails' `resolve_config_for_connection(database_key)` to set `_connectionSpecificationName` as a side effect. No current test exercises it.
- ~2 LOC (C) — `isPreventingWrites()` class-name string match can drift if class is renamed but pool registered under different owner-name. Very low practical risk.

## MySQL active-schema cluster (~680 LOC across 3 remaining slots, from audit-mysql-active-schema)

**Supersedes the previous Schema-cluster Slot G estimate.** Slot A closed (SQL-capture test infra + first un-skips). Remaining:

1. **Slot B** (~220 LOC) — MySQL DDL SQL parity (`dropTable` comma form, `createDatabase`/`recreateDatabase`, `indexAlgorithm` validator).
2. **Slot C** (~260 LOC) — `addIndex` MySQL output shape + inline `t.index` in `create_table`.
3. **Slot D** (~200 LOC) — Bulk change-table ALTER coalescing + timestamp tests.

## MySQL mysql2-adapter cluster (~700 LOC across 3 slots, from audit-mysql-mysql2-adapter)

9 BLOCKED tests in `adapters/mysql2/mysql2-adapter.test.ts`. Three slots:

1. **Slot A — `databaseExists` static + `exec_query(prepare:)` + DML-tolerant execQuery** (~220 LOC). Test-only "fake_connection" path that lets `Mysql2Adapter` instantiate without a live driver underpins several tests.
2. **Slot B — Translate-exception depth: timeout + statement-timeout** (~200 LOC). `read_timeout` → `AdapterTimeout`, `ER_FILSORT_ABORT` / `ER_QUERY_TIMEOUT` → `StatementTimeout`.
3. **Slot C — Timezone re-sync + db_warnings_action + test-helper infra** (~280 LOC). `query_options[:database_timezone]` plumbing + `with_db_warnings_action`.

## PG virtual-column cluster (~250 LOC, Slot B remaining)

<<<<<<< Updated upstream

- **Slot B** (~250 LOC) — Live-PG round-trip harness + un-skip 5 Rails-mirrored tests. `defineSchema`-less `create_table`; `change_table { |t| t.virtual ... }`; `buildFixtureSql` virtual-column filter.
  ||||||| Stash base
- ~30 LOC — Extract MySQL `buildCreateIndexDefinition` pre-flight into a shared helper consumed by both `AbstractMysqlAdapter.buildCreateIndexDefinition` and `MysqlSchemaStatements.addIndex` (currently duplicated because `TestDatabaseAdapter`/`SchemaAdapter` doesn't forward `addIndex` to the raw adapter).
- ~40 LOC — Refactor abstract `SchemaStatements.addIndex` (`abstract/schema-statements.ts:257`) to delegate to `buildCreateIndexDefinition` (Rails' `AbstractAdapter#add_index` does). Then MySQL just overrides `buildCreateIndexDefinition` instead of `addIndex`.

**Slot C pre-existing notes:**

- `_mysqlInlineIndexSql` in `TableDefinition.toSql()` duplicates `MysqlSchemaCreation.visitIndexDefinition` logic; must update both if MySQL index options grow.
- Inline form doesn't handle per-column `order` option (Rails' `addOptionsForIndexColumns` handles both length and order).
- `MigrationContext.createTable` parallel index-creation loop in `migration.ts` duplicates `SchemaStatements.createTable`.

**Slot B followups (~40 LOC bundle):**

- ~10 LOC — `typeToSql` `unsigned` suffix: append `" unsigned"` when `options.unsigned && type !== "primary_key"`. Unblocks unsigned integer column migrations.
- ~30 LOC — `addTimestamps`/`removeTimestamps` DDL type-check (datetime emit verified; only blocked on live-table scope).

**Pre-existing notes:**

- `MysqlSchemaCreation` instance in `mysql2-adapter.ts` is constructed without adapter ref; safe today (stateless + quoting passed in constructor) but any future method needing live adapter will fail silently.
- `recreateDatabase` skips Rails' `reconnect!` (TS async pool handles implicitly).
- `indexAlgorithm` error message uses `'default', 'copy', ...` strings vs Rails' `:default, :copy, ...` symbol inspect.

## MySQL mysql2-adapter cluster — Slot A closed (#1617); B + C remain (~480 LOC)

1. **Slot B — Translate-exception depth: timeout + statement-timeout** (~200 LOC). `read_timeout` → `AdapterTimeout`, `ER_FILSORT_ABORT` / `ER_QUERY_TIMEOUT` → `StatementTimeout`.
2. **Slot C — Timezone re-sync + db_warnings_action + test-helper infra** (~280 LOC). `query_options[:database_timezone]` plumbing + `with_db_warnings_action`.

**Slot A pre-existing notes:**

- `_fakeConnection` sentinel lives in public `MysqlAdapterOptions` with `@internal` JSDoc (no global `stripInternal`; ~5 LOC tsconfig followup, repo-wide).
- `execQuery` does not update `database_timezone` per-query (Slot C scope).
- `_shouldPrepare` with `statementLimit === 0` + explicit `prepare: true` accumulates server-side prepared statements without unprepare. Pre-existing in `execute`/`executeMutation`; low risk.

## PG virtual-column cluster — all slots closed (#1594)

**Followups (~120 LOC):**

- ~10 LOC — `addColumn` virtual + `comment` option: live-PG test that `changeColumnComment` reaches `pg_description` for virtual columns.
- ~10 LOC — Un-skip `schema dumping` test (`adapters/postgresql/virtual-column.test.ts:90`): `schema-dumper.ts:emitTable` bypasses `prepareColumnOptions` for virtual columns so `as`/`stored` never reach output.
- ~30 LOC — `_schemaLoadPromise` STI cascade regression test (`model-schema.ts:512–541`). Promote `_schemaLoadPromise` onto `SchemaHost` proper to remove the cast.
- ~80 LOC — Retire `SimpleTableBuilder` (`postgresql-adapter.ts:5180+`) and unify `addColumn` + `createTable` virtual paths through `schemaCreation.accept(...)` visitor. Today `DEFAULT`/`NOT NULL`/`COLLATE` are duplicated between `addColumn` and `addColumnOptionsBang`; `SimpleTableBuilder.virtual` silently drops `null`/`default`/`comment`.

**Pre-existing notes:**

- `virtual()` with omitted `options.as` silently creates a plain column — matches Rails `add_column_options!` `if as = options[:as]` wrap.
- # PG 18 will need `_pgGeneratedClause` server-version gate for `stored: false` → `VIRTUAL`. Single point of change.
- ~30 LOC — Extract MySQL `buildCreateIndexDefinition` pre-flight into a shared helper consumed by both `AbstractMysqlAdapter.buildCreateIndexDefinition` and `MysqlSchemaStatements.addIndex` (currently duplicated because `TestDatabaseAdapter`/`SchemaAdapter` doesn't forward `addIndex` to the raw adapter).
- ~40 LOC — Refactor abstract `SchemaStatements.addIndex` (`abstract/schema-statements.ts:257`) to delegate to `buildCreateIndexDefinition` (Rails' `AbstractAdapter#add_index` does). Then MySQL just overrides `buildCreateIndexDefinition` instead of `addIndex`.

**Slot C pre-existing notes:**

- `_mysqlInlineIndexSql` in `TableDefinition.toSql()` duplicates `MysqlSchemaCreation.visitIndexDefinition` logic; must update both if MySQL index options grow.
- Inline form doesn't handle per-column `order` option (Rails' `addOptionsForIndexColumns` handles both length and order).
- `MigrationContext.createTable` parallel index-creation loop in `migration.ts` duplicates `SchemaStatements.createTable`.

**Slot B followups (~40 LOC bundle):**

- ~10 LOC — `typeToSql` `unsigned` suffix: append `" unsigned"` when `options.unsigned && type !== "primary_key"`. Unblocks unsigned integer column migrations.
- ~30 LOC — `addTimestamps`/`removeTimestamps` DDL type-check (datetime emit verified; only blocked on live-table scope).

**Pre-existing notes:**

- `MysqlSchemaCreation` instance in `mysql2-adapter.ts` is constructed without adapter ref; safe today (stateless + quoting passed in constructor) but any future method needing live adapter will fail silently.
- `recreateDatabase` skips Rails' `reconnect!` (TS async pool handles implicitly).
- `indexAlgorithm` error message uses `'default', 'copy', ...` strings vs Rails' `:default, :copy, ...` symbol inspect.

## MySQL mysql2-adapter cluster — all slots closed (#1617, #1647, #1662)

**Slot C followups (~60 LOC):**

- ~30 LOC — Wire `Rails.error.report` for `report` warning action (joint with PG `_flushWarnings`'s `TODO(report)`). Blocked on global ErrorReporter singleton.
- ~20 LOC — Hoist `CLIENT_NOT_CONNECTED_RE` into `isClientNotConnected(e)` predicate; abstract `when nil` branch could gate on error shape (code undefined or connection-protocol codes) to shrink the "abstract `when nil` fires for any errno-less Error matching" deviation.
- ~10 LOC — When `Mysql2Adapter#configureConnection` no-op gets real impl (per-pool-connection init), set `database_timezone`-equivalent state from `getDefaultTimezone()` so first-query sync isn't load-bearing.

**Pre-existing notes:** `_syncDatabaseTimezone()` called per-method (execute/execQuery/executeMutation/exec/explain) not centralized — matches Rails `perform_query`-only sync. `databaseTimezone` is per-adapter field, not per-PoolConnection (Rails ties to single `@raw_connection`).

**Slot B followups (~110 LOC):**

- ~30 LOC — Wire 4 lock/range/canceled cases into `AbstractMysqlAdapter._translateException`: `ER_LOCK_DEADLOCK`→`Deadlocked`, `ER_LOCK_WAIT_TIMEOUT`→`LockWaitTimeout`, `ER_QUERY_INTERRUPTED`→`QueryCanceled`, `ER_OUT_OF_RANGE`→`RangeError` (error classes + constants already exist; just missing switch cases).
- ~80 LOC — `Mysql2Adapter` `ConnectionError` branch (`Mysql2::Error::ConnectionError` → `ConnectionNotEstablished` when msg matches `/MySQL client is not connected/i`, else `ConnectionFailed`) + abstract `when nil → ConnectionNotEstablished`. Verify/add `DatabaseAlreadyExists` for `ER_DB_CREATE_EXISTS` mapping.

Bundles cleanly as a single fidelity-sweep PR (~110–150 LOC).

1. **Slot B — Translate-exception depth: timeout + statement-timeout** (~200 LOC). `read_timeout` → `AdapterTimeout`, `ER_FILSORT_ABORT` / `ER_QUERY_TIMEOUT` → `StatementTimeout`.
2. **Slot C — Timezone re-sync + db_warnings_action + test-helper infra** (~280 LOC). `query_options[:database_timezone]` plumbing + `with_db_warnings_action`.

**Slot A pre-existing notes:**

- `_fakeConnection` sentinel lives in public `MysqlAdapterOptions` with `@internal` JSDoc (no global `stripInternal`; ~5 LOC tsconfig followup, repo-wide).
- `execQuery` does not update `database_timezone` per-query (Slot C scope).
- `_shouldPrepare` with `statementLimit === 0` + explicit `prepare: true` accumulates server-side prepared statements without unprepare. Pre-existing in `execute`/`executeMutation`; low risk.

## PG virtual-column cluster — all slots closed (#1594)

**Followups (~120 LOC):**

- ~10 LOC — `addColumn` virtual + `comment` option: live-PG test that `changeColumnComment` reaches `pg_description` for virtual columns.
- ~10 LOC — Un-skip `schema dumping` test (`adapters/postgresql/virtual-column.test.ts:90`): `schema-dumper.ts:emitTable` bypasses `prepareColumnOptions` for virtual columns so `as`/`stored` never reach output.
- ~30 LOC — `_schemaLoadPromise` STI cascade regression test (`model-schema.ts:512–541`). Promote `_schemaLoadPromise` onto `SchemaHost` proper to remove the cast.
- ~80 LOC — Retire `SimpleTableBuilder` (`postgresql-adapter.ts:5180+`) and unify `addColumn` + `createTable` virtual paths through `schemaCreation.accept(...)` visitor. Today `DEFAULT`/`NOT NULL`/`COLLATE` are duplicated between `addColumn` and `addColumnOptionsBang`; `SimpleTableBuilder.virtual` silently drops `null`/`default`/`comment`.

**Pre-existing notes:**

- `virtual()` with omitted `options.as` silently creates a plain column — matches Rails `add_column_options!` `if as = options[:as]` wrap.
- PG 18 will need `_pgGeneratedClause` server-version gate for `stored: false` → `VIRTUAL`. Single point of change.
  > > > > > > > Stashed changes

---

## PG-schema audit cluster (closed)

Slots A (#1504 indexes() opclass + nulls order), B (#1458 INHERITS + #1469 comment/partition), C (#1469 schema-qualified createJoinTable), and Slot A followup (`indexes()` INCLUDE column filtering via `ix.indnkeyatts`) all closed. The 3 `SchemaIndexNullsNotDistinctTest` tests, `setSchemaSearchPath` unquoted-`$user` rejection, and Thing1..5 / Song-Album fixture-model gaps were resolved by prior Slot H-b work (#1592 / #1618).

## Unknown-triage cluster (~640 LOC, from audit-unknown-triage)

Re-categorization of all 89 `BLOCKED: unknown` annotations. **Single foundational annotation-refresh PR** unblocks downstream slot-sizing:

1. **Slot A — Annotation refresh** (~200 LOC, comment-only). Re-tag all 89 annotations into the controlled vocabulary, moving the Ruby-only language-semantics ones (`modules.test.ts` x7, `mixin.test.ts` x2, `base.test.ts` x1 — `Module#prepend`, `singleton_class`, `Module#ancestors`, constant-path lookup) to `PERMANENT-SKIP` form in `unported-files.ts`.
2. **Slot B — `insert-all.test.ts` investigation + un-skip** (~250 LOC). **64 of the 89 have stale "`MemoryAdapter accepts any attrs"` comments** that mislead the audit — there is no `MemoryAdapter`; the test setup uses `SchemaAdapter` wrapping a real driver. `InsertAll` impl is at 100% per. Real work: scrub stale comments (largely done), investigate what's actually skipped, rewrite test bodies to assert against real-adapter behavior.
3. **Slot C — SignedId real-feature gaps** — closed (#1684). ~20 LOC followup: `Relation.findSigned` / `Relation.findSignedBang` scoping wrappers (mirrors Rails `SignedId::RelationMethods`); un-skips 2 remaining `find signed record on relation` / `find signed record with a bang on relation` tests.
4. **Slot D — Callbacks `afterCommit` refinements** (~50 LOC).
5. **Deferred** — Misc small feature closes (~80 LOC); timezone-aware attribute methods (~150 LOC).

## STI annotation drift (~20 LOC, tests-only)

audit-STI found **no STI implementation gap**. All 6 `BLOCKED: STI` tests are mis-labeled — real causes are missing fixture scopes, UUID PK + touch on polymorphic delegated_type, and PG `CREATE TABLE … INHERITS` schema-dump . Single tests-only PR re-annotates the 6 tests under correct categories.

## Schema cluster — Slots D, E, F, H-b, I, J closed (#1467, #1546, #1564, #1576, #1618, #1650, #1665); Slot H partial; K remains

**Slot I followups (~25 LOC):**

- ~5 LOC — Add `supportsNativePartitioning()` skip guard to `partitions.test.ts` tests (mirrors Rails `skip unless database_version >= 100000`).
- ~10 LOC — Drop or align extra `partition table` test in `partitions.test.ts` with Rails `partitions_test.rb` (Rails only has `test_partitions_table_exists`).
- ~10 LOC — Move `commented_table` round-trip into its own describe block (Rails layout parity).

Note: Slot I shipped ~113 LOC vs ~250 sized — the dump wiring (`pgSchemaDumper.fetchTableOptions` → `tableOptions` → `inheritedTableNames` / `tablePartitionDefinition`) had already landed in the Slot H window. The 6 "un-skips" were already gated by `describeIfPg` (stale framing).

**Slot J followups (~185 LOC):**

- ~30 LOC — Un-skip `marshal dump and load with ignored tables`: wire `ActiveRecord.schemaCacheIgnoredTables` config into `tablesToCache`/`addAll` (Rails `schema_cache.rb:436-438`).
- ~40 LOC — Un-skip `marshal dump and load with gzip` + `yaml dump and load with gzip` (gzip plumbing landed; tests assert Rails serialization shapes — need TS equivalent or rewrite to JSON+gzip).
- ~80 LOC — Un-skip `when lazily load schema cache is set cache is lazily populated when est connection` (needs lazy-load wiring on connection-pool establish).
- ~20 LOC — `yaml loads 5 1 dump` / `yaml loads 5 1 dump without indexes still queries for indexes`: drop as Rails-specific 5.1 YAML, or replicate fixture for JSON path.
- ~15 LOC — Unify `addTimestamps` to route through `addTimestampsForAlter` + single `executeMutation` (currently issues two `addColumn` calls vs Rails' one combined ALTER).
- Pre-existing: `Migration#changeTable` has both explicit method and method_missing dispatch; Rails has only method_missing. Revisit when method_missing unified.
- Pre-existing: `Gzip.compress`/`decompress` go through `latin1` strings; Buffer-native would skip encode/decode hop.

1. **Slot H-b** (~310 LOC, 13 un-skips, in flight as Slot-H followup #1592 closed partial; rest remain) — `where/pluck/classes with qualified schema name` (~200 LOC Thing1..5 AR models), `sequence schema caching` SchemaThing (~50 LOC), `habtm table name with schema` Song/Album (~30 LOC), `schema change with prepared stmt` (~20 LOC), `Active Record basics` dot-in-schema (~10 LOC). Recommended: shared `defineSchema`-based fixture file (pattern in `active-schema.test.ts`).
2. **Slot I** (~250 LOC, exploratory) — PG partitioning + inheritance introspection in dumper. 6 un-skips.
3. **Slot J** (~120 LOC) — `Schema.define` with `tableNamePrefix` + bulk-change timestamps default + SchemaCache portable bits. 5 un-skips.
4. **Slot K** — Annotation normalization across all 128 BLOCKED annotations. Lands AFTER H-b/I/J.

**Followups (~285 LOC across closed slots):**

- ~10 LOC (H) — `SchemaDumper.dump(adapter)` static method instantiates base class, not `PgSchemaDumper`. Make `dump(adapter)` dispatch through `adapter.createSchemaDumper()` when available.
- ~15 LOC (F) — Wire `changeColumn` through `changeColumnForAlter` → `SchemaCreation#accept` (Rails routing). Today functionally equivalent; future SchemaCreation visitor extensions mirror manually otherwise.
- ~20 LOC (E) — `schema load scoped to schemas` un-skip: needs `schema-cache.ts#clear` invalidation.
- ~50 LOC (E) — `schema dump scoped to schemas` un-skip in enum.test.ts: `enumTypes()` schema-scoped filtering + `with_test_schema` infra.
- ~50–200 LOC (E) — `dumping schemas` / `dump foreign key targeting different schema` / `Active Record basics` (SchemaWithDotsTest) — root-caused to incomplete `schema.ts`. Fold into a schema-dumper-specific slot.

## PG-adapter cluster — Slot A closed (#1545, #1567); Slot E optional

1. **Slot E** (optional, ~120 LOC) — Prepared-statements introspection. 3 un-skips.

**Followups (~40 LOC):**

- ~10 LOC — Promote `_instrumentedQueryOnClient` to a named internal helper and dedupe with `execQuery`'s inner lambda. Cosmetic.
- ~30 LOC — Unify `execInsert` paths: abstract default (`abstract/database-statements.ts:1375`) bypasses `sqlForInsert` entirely; a separate standalone `execInsert` function (line 390) does the right thing but isn't wired. Wire it in (or rewrite the default to call `sqlForInsert` first). Then the PG-specific `pk === false` scaffolding (#1567) can be removed.

## Transactions cluster — Slots B, C, D closed (#1572, #1651); E deferred

**Slot D followups (~50 LOC):**

- ~10 LOC — Un-skip `write attribute after rollback` (`transactions.test.ts` ~1664); same Topic fixture as `read attribute after rollback`, trivial port.
- ~15 LOC — Un-skip `test_assign_custom_primary_key_after_rollback` (unblocked by wTRS fix tracked separately).
- ~10 LOC — `restore previously new record after double save` — needs `_startTransactionState` snapshot timing fix (deferred).
- ~5 LOC — `scripts/test-compare/normalize-skips.ts` `transaction-isolation.test.ts` entry: replace stale "GVL" wording with PG-required gating (or remove if no `it.skip` remains).
- ~10 LOC — `primaryKey = "movieid"` should auto-declare the attribute so callers don't need redundant `attribute("movieid", "integer")` (DX gap).
- Pre-existing: Rails `Tag.establish_connection :arunit` checks out from same pool; our `withSecondAdapter` uses fully independent pools. Equivalent for dirty-read/non-repeatable-read semantics; could matter for future serializability tests.

1. **Slot D** (~80 LOC) — Wire isolation tests through PG-adapter Slot D's `secondConnection` helper. 4–6 un-skips.
2. **Slot E** (deferred) — Autosave + nested_attributes (depends on `accepts_nested_attributes_for`).

**Followups (~55 LOC):**

- ~10 LOC — Un-skip `test_read_attribute_with_custom_primary_key_after_rollback` + `test_write_attribute_with_custom_primary_key_after_rollback` (same Movie fixture).
- ~10 LOC — Un-skip `restore previously new record after double save`: `_startTransactionState` snapshot is re-taken per wTRS call, so second save's `afterRollback` overwrites the correct restore. Fix capture timing.
- ~15 LOC — Un-skip `test_assign_custom_primary_key_after_rollback` (Movie create → tx update PK → rollback). Unblocked by wTRS fix.
- ~20 LOC — Deeper `update should rollback on failure!` fidelity: needs `update()` to call property setters (not just `writeAttribute`) so `replyIds: []` collection-clear works inline. Pre-existing: Rails `assign_attributes` calls setters; our writeAttribute loop doesn't.

## `NotImplementedError` elimination initiative — Phase 2 closed (#1663); remainder folds into cluster slots

**Goal: zero unjustified `NotImplementedError` throws when AR is "done."** PR #1523 annotated every throw site with `// @nie disposition=... rails=... cluster=...` and added the `blazetrails/nie-requires-annotation` ESLint rule. The annotations are now the **source of truth**; the 2026-05-11 audit numbers are superseded.

**Corrected disposition tally (per #1523 per-site verification):** 34 sites total.

- **port-real**: 23 — Rails has a real implementation; ours is a stub.
- **keep-as-strategy-hook**: 11 — Rails also raises (abstract method); we match its behavior. (Up from the original 8; #1523 found Rails has real impls for `rawExecute`, `appendCallbacks`, `lookupCastType`, SQLite3 `arelVisitor`.)
- **remove-from-class**: 0 — none. (Was 7 in the original audit; reclassified after Rails-source verification.)

**Sweeps A–G obsoleted.** The 23 port-real sites are concentrated in clusters that have their own slots — `mysql-mysql2-adapter` (4), `mysql-charset-collation` (3), `pg-long-tail` (3), `relation` (3), plus 10 in abstract/non-cluster files. The port-real work folds into existing cluster slots; no dedicated Sweep PRs needed. Track via `grep "@nie disposition=port-real" packages/activerecord/src/` — the count should decrease as cluster work lands.

**Followups from #1523:**

- ~30 LOC — `rails=file:line` annotations on the 30 sites that carry only file paths (the 4 corrected during verification have line numbers; the rest don't). Mechanical follow-up; speeds eventual port-real work.
- ~5 LOC — Extend the ESLint rule to other Rails-mirroring packages (actionpack, actionview, activemodel, activesupport, arel). None currently has NIE throws; deferred until one shows up.
- Optional — companion warn-rule on `disposition=TODO` so unclassified throws can't sit indefinitely.

## Single-slot items

These don't merit their own multi-slot cluster section.

### autosaveBelongsTo dead-code removal (~5 LOC, from #1555)

After #1555 moved belongs_to autosave into the `before_save` chain via `defineNonCyclicMethod`, the standalone `autosaveBelongsTo` function in `packages/activerecord/src/autosave-association.ts:375` and its `_autosavingRecords` add/delete calls are unreferenced. Delete the function body; keep the `_autosavingRecords` WeakSet (still used by `autosaveChildren`). Bundle into next fidelity sweep.

<<<<<<< Updated upstream

### MySQL onUpdate followups closed (#1402, follow-up bundle)

||||||| Stash base

### MySQL onUpdate followups (~30 LOC, from #1382)

=======

### MySQL onUpdate followups — closed (#1382 + #1682)

> > > > > > > Stashed changes

<<<<<<< Updated upstream

- `onUpdate` abstract leakage closed in #1402 — `onUpdate` moved off abstract `ColumnOptions` onto `MysqlAddColumnOptions` in mysql/schema-creation.ts.
- Function-default detection in `renameColumnForAlter` widened — non-DEFAULT_GENERATED defaults outside `RENAME_FUNC_DEFAULT_RE` now route through `defaultType(createTableInfo, columnName)`, mirroring Rails' `new_column_from_field` broader detection.
  ||||||| Stash base
- **`onUpdate` abstract leakage** — lives in abstract `ColumnOptions`/`addColumnOptions`; MySQL-specific option leaking into abstract layer. Move to MySQL override. Low risk in practice.
- # **Function-default detection narrowness** — `renameColumnForAlter` regex only covers `CURRENT_TIMESTAMP`. Bundled into small-followup sweep.
  **Remaining followup (~40 LOC, optional structural refactor):** Route `renameColumnForAlter` through `columnFor` like Rails (`abstract_mysql_adapter.rb:863-878`) _and_ extend `newColumnFromField` so `on_update` and compound `DEFAULT_GENERATED on update X` cases keep flowing through. Centralizes function-default logic instead of duplicating between `newColumnFromField` and `renameColumnForAlter`. Net structural win, no behavior change. Includes ~5 LOC widening of `meta.extra === "DEFAULT_GENERATED"` strict equality to startsWith/regex.
  > > > > > > > Stashed changes

### Unported-list additions (~30 LOC bundled, 1 PR)

Mechanical: add these to `scripts/api-compare/unported-files.ts` as `PERMANENT-SKIP`. Each was identified by an audit; none reflect a real feature gap.

- `sqlite3-adapter.test.ts` — `read_uncommitted` cross-connection test (better-sqlite3 single-process model).
- `sqlite3-adapter.test.ts` — `loadExtension` / `supports_extensions` (driver doesn't expose).
- `modules.test.ts` (×7), `mixin.test.ts` (×2), `base.test.ts` (×1) — Ruby `Module#prepend` / `singleton_class` / `Module#ancestors` / constant-path-lookup semantics.

Most of this landed; remainder is the residual cleanup pass.

### AR query-parity residual — datetime precision (ar-01 / ar-52 / ar-65)

One gap tracked in [`scripts/parity/canonical/query-known-gaps.json`](../scripts/parity/canonical/query-known-gaps.json) (four gaps closed/#856/#863/#899).

**Goal:** `Order.where(created_at: oneWeekAgo..now).toSql()` emits second-precision SQL matching Rails' `quoted_date` (no fractional seconds for unscaled DATETIME columns).

**Current behaviour** (when frozen-at has non-zero ms, e.g. `175ms`):

```sql
... WHERE "orders"."created_at" BETWEEN '2026-04-18 17:53:16.175000' AND '2026-04-25 17:53:16.175000'
```

**Expected (Rails):**

```sql
... WHERE "orders"."created_at" BETWEEN '2026-04-18 17:53:16' AND '2026-04-25 17:53:16'
```

**Root cause.** Trails inlines dates from `Quoted` nodes with full precision. added bind extraction for `compileWithBinds`, but `toSql()` still inlines. The gap flakes (closes when frozen-at lands on a whole second).

**Options:**

- **Option A (BindParam-first, ~80 LOC):** In `predicate-builder/basic-object-handler.ts` + `range-handler.ts`, wrap Date values in `new Nodes.BindParam(queryAttribute)` instead of `Quoted`. Add a `quotedDateForBind` branch in `visitBindParam` that truncates to seconds. Don't change `visitQuoted` (INSERT precision preserved).
- **Option B (parity-runner side):**'s `paramSql` + binds comparison would close this in the diff layer without trails code changes — runner compares binds as ISO 8601 cross-side.

**Risk:** Medium — touches every WHERE clause in the suite. Must keep INSERT microsecond precision and numeric/string predicates unchanged. Files touched (Option A): `predicate-builder/basic-object-handler.ts`, `predicate-builder/range-handler.ts`, `arel/src/visitors/to-sql.ts#visitBindParam`, plus `scripts/parity/fixtures/ar-01/`, `ar-52/`, `ar-65/`.

---

## See also

- [`activerecord-100-plan.md`](activerecord-100-plan.md) — live tracker: in-flight PRs, post-merge fidelity followups, doc-hygiene, story count, guardrails.
- [`test-compare-100-plan.md`](test-compare-100-plan.md) — strategy + workflow + BLOCKED vocab reference.
- [`scripts/api-compare/unported-files.ts`](../scripts/api-compare/unported-files.ts) — canonical not-portable list.
