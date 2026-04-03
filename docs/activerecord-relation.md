# ActiveRecord Relation: Road to 100%

Current: **163/253 methods matched** across relation files (64%).
6 files already at 100%. 13 files need work.

## Key insight: structural mismatch

Many methods exist in our `relation.ts` but api:compare can't find them
because Rails defines them in separate module files that get `include`d into
Relation. The compare tool matches by file — so `where` in `relation.ts`
doesn't count toward `relation/query_methods.rb`.

**This is the single biggest win:** moving (or re-exporting) methods into
the files the compare tool expects.

## File-by-file plan

### relation/query-methods.ts — 45/83 (54%) — 38 missing

The biggest gap. Rails' `query_methods.rb` defines the query interface as
module methods. Our `query-methods.ts` only has constant arrays
(`MULTI_VALUE_METHODS`, `SINGLE_VALUE_METHODS`). The actual methods
(`where`, `order`, `select`, `limit`, `group`, etc.) live on `Relation` in
`relation.ts`.

**Missing methods fall into three categories:**

1. **Bang variants (mutate in place):** `includesBang`, `eagerLoadBang`,
   `preloadBang`, `referencesBang`, `withBang`, `withRecursiveBang`,
   `reselectBang`, `groupBang`, `regroupBang`, `orderBang`, `reorderBang`,
   `unscope!`, `joinsBang`, `leftOuterJoinsBang`, `havingBang`,
   `limitBang`, `offsetBang`, `lockBang`, `noneBang`, `fromBang`,
   `annotatesBang`, `optimizerHintsBang`
   — In Rails, each query method `foo` has a `foo!` variant that mutates
   `self` instead of cloning. Our Relation creates a clone for every call.
   Adding bang variants means adding a `_mutate` path.

2. **Methods that exist on Relation but aren't in this file:**
   `or`, `structurallyCompatible`, `whereSqlForColumns`
   — Need to be exported from `query-methods.ts` for api:compare.

3. **Methods not yet implemented:**
   `with_recursive`, `regroup`, `optimizer_hints`, `in_order_of`,
   `excluding`/`without`
   — Need actual implementation.

**Approach:** Export `this`-typed functions from `query-methods.ts` that
delegate to the existing Relation methods. Add bang variants that mutate
instead of clone. Implement missing query methods.

### relation.rb — 48/66 (73%) — 18 missing

| Method                | Complexity | Notes                                       |
| --------------------- | ---------- | ------------------------------------------- |
| `predicateBuilder`    | Low        | Expose existing `_predicateBuilder`         |
| `skipPreloadingValue` | Low        | Accessor for existing value                 |
| `bindAttribute`       | Low        | Delegate to predicate builder               |
| `cacheKey`            | Medium     | Compute from table name + query hash        |
| `computeCacheKey`     | Medium     | Internal for `cacheKey`                     |
| `cacheVersion`        | Medium     | Max `updated_at` from results               |
| `computeCacheVersion` | Medium     | Internal for `cacheVersion`                 |
| `cacheKeyWithVersion` | Low        | `"#{cacheKey}-#{cacheVersion}"`             |
| `scoping`             | Medium     | Push relation onto thread-local scope stack |
| `isScheduled`         | Low        | Accessor                                    |
| + 8 more              |            | (truncated by compare tool)                 |

### relation/where-clause.ts — 5/9 (56%) — 4 missing

| Method              | Complexity | Notes                                |
| ------------------- | ---------- | ------------------------------------ |
| `or`                | Medium     | Combine two where clauses with OR    |
| `ast`               | Medium     | Convert to Arel AST node             |
| `isContradiction`   | Low        | Check if clause is always false      |
| `extractAttributes` | Medium     | Pull attribute names from predicates |

### relation/predicate-builder.ts — 3/8 (38%) — 5 missing

| Method                 | Complexity | Notes                                    |
| ---------------------- | ---------- | ---------------------------------------- |
| `registerHandler`      | Low        | Add custom type handler                  |
| `buildBindAttribute`   | Medium     | Create bind param for value              |
| `resolveArelAttribute` | Low        | Table + column → Arel attribute          |
| `with`                 | Low        | Return builder with context              |
| `references`           | Low        | Extract table references from predicates |

### relation/delegation.ts — 1/9 (11%) — 8 missing

Rails' delegation module auto-generates methods on Relation that delegate
to `klass` (the model class). Most missing methods are class-level
meta-programming (`generateMethod`, `delegatedClasses`,
`initializeRelationDelegateCache`, etc.).

**Approach:** Implement the delegation registry. Low-priority since these
are internal plumbing methods, not user-facing API.

### relation/batches/batch-enumerator.ts — 5/11 (45%) — 6 missing

| Method             | Complexity | Notes                                               |
| ------------------ | ---------- | --------------------------------------------------- |
| `start` / `finish` | Low        | Accessor for range bounds                           |
| `relation`         | Low        | Accessor                                            |
| `batchSize`        | Low        | Accessor                                            |
| `touchAll`         | Medium     | Batch touch_all across records                      |
| `each`             | Low        | Iterator (may already exist as `[Symbol.iterator]`) |

### Other small files (1-2 missing each)

| File                      | Missing | Method                             | Notes                   |
| ------------------------- | ------- | ---------------------------------- | ----------------------- |
| `finder-methods.ts`       | 1       | `raiseRecordNotFoundExceptionBang` | Error builder           |
| `from-clause.ts`          | 1       | `name`                             | Accessor                |
| `merger.ts`               | 1       | `values`                           | Accessor                |
| `spawn-methods.ts`        | 1       | `mergeBang`                        | In-place merge          |
| `array-handler.ts`        | 1       | `or`                               | OR predicate for arrays |
| `basic-object-handler.ts` | 1       | `constructor`                      | Initialize handler      |
| `range-handler.ts`        | 1       | `constructor`                      | Initialize handler      |

## Suggested PR sequence

### PR 1: Query methods bang variants + file reorganization (~30 methods)

The single highest-impact PR. Most query methods already exist on Relation
but aren't in `query-methods.ts`:

1. Export `this`-typed functions from `query-methods.ts` for each existing
   query method (`where`, `order`, `select`, `limit`, `group`, `having`,
   `joins`, `leftOuterJoins`, `distinct`, `from`, `lock`, `reorder`,
   `reselect`, `none`, `unscope`, `readonly`, `extending`, `annotate`,
   `with`, `includes`, `eagerLoad`, `preload`, `references`, `offset`)
2. Add bang variants that mutate `this` instead of cloning
3. Implement missing methods: `withRecursive`, `regroup`, `inOrderOf`,
   `excluding`/`without`, `optimizerHints`

Expected gain: ~30-35 methods → query-methods.ts from 54% to ~90%+.

### PR 2: relation.rb completion (~18 methods)

Add `cacheKey`/`cacheVersion`/`cacheKeyWithVersion`, `scoping`,
`predicateBuilder` accessor, `bindAttribute`, and remaining accessors.

### PR 3: WhereClause + PredicateBuilder (~9 methods)

`or`, `ast`, `isContradiction` on WhereClause. `registerHandler`,
`buildBindAttribute`, `resolveArelAttribute` on PredicateBuilder.

### PR 4: Small files cleanup (~15 methods)

BatchEnumerator accessors, delegation plumbing, single-method gaps across
finder-methods, from-clause, merger, spawn-methods, predicate builder handlers.

## Total

90 methods across 4 PRs would bring relation files from 163/253 (64%) to
~253/253 (100%).
