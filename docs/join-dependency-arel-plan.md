# JoinDependency → Arel AST Plan

## Problem

Our `JoinDependency` builds raw SQL strings (`joinSql` on each `JoinNode`) and
needs adapter-aware quoting at construction time. Rails' `JoinDependency` builds
an Arel AST and never touches the adapter — quoting happens later when the
visitor compiles the AST.

**Our approach:**

```
JoinDependency.addAssociation()
  → manually builds "LEFT OUTER JOIN t ON t.fk = s.pk" strings
  → needs _adapter, _qt(), _qc(), _quoteString() at construction time
  → joinConstraints() wraps strings in StringJoin nodes
  → _buildEagerJoinManager() reads node.joinSql as raw SQL
```

**Rails' approach:**

```
JoinDependency#join_constraints
  → delegates to JoinAssociation#join_constraints
  → calls reflection.join_scope(table, foreign_table, foreign_klass)
  → extracts scope.arel.constraints (Arel predicates)
  → wraps in join_type.new(table, Arel::Nodes::On.new(predicates))
  → returns Arel::Nodes::OuterJoin nodes
```

Key difference: Rails uses `reflection.join_scope()` which returns a Relation
whose `.arel.constraints` are proper Arel predicates. We already have
`reflection.joinScope()` (reflection.ts:129) that does the same thing — building
`table.get(pk).eq(foreignTable.get(fk))` — but `JoinDependency` ignores it and
hand-builds SQL instead.

## What we already have

- `Nodes.OuterJoin` (extends `Join extends Binary`) — packages/arel/src/nodes/outer-join.ts
- `Nodes.On` (extends `Unary`) — packages/arel/src/nodes/unary.ts:23
- `Table#createJoin(to, constraint, klass)` — packages/arel/src/table.ts:216
- `Nodes.As` (extends `Binary`) — for column alias expressions
- `SelectManager#appendJoinNode(node)` — packages/arel/src/select-manager.ts:649
- `reflection.joinScope(table, foreignTable, foreignKlass)` — builds Arel
  predicates via `table.get(pk).eq(foreignTable.get(fk))` + polymorphic type +
  scope merging

## Target state

`JoinDependency` uses `reflection.joinScope()` to get Arel predicates, wraps
them in `OuterJoin(table, On(predicates))`, and returns those nodes. The
`_adapter` field and all manual quoting helpers are deleted.

## PR sequence

### PR 1 — JoinAssociation class + reflection-based join building (~250 LOC)

Extract a `JoinAssociation` class (mirrors Rails' `JoinDependency::JoinAssociation`):

```ts
class JoinAssociation {
  reflection: AbstractReflection;
  table: Table; // aliased Arel::Table for this join target

  joinConstraints(
    foreignTable: Table,
    foreignKlass: typeof Base,
    joinType: typeof OuterJoin,
  ): Join[] {
    const scope = this.reflection.joinScope(this.table, foreignTable, foreignKlass);
    const arel = scope.arel();
    const predicates = arel.constraints; // Arel::Nodes::And or single predicate
    return [new joinType(this.table, new On(predicates))];
  }
}
```

This is the core behavioral change. The reflection already builds the correct
predicates; we just need to extract them and wrap in `OuterJoin`.

Scope handling comes for free — `reflection.joinScope()` already merges
association scopes via `joinScopes()` → `scope(rel)`. No regex parsing needed.

### PR 2 — Wire JoinAssociation into JoinDependency (~250 LOC)

Replace `addAssociation`'s manual SQL building with `JoinAssociation` creation:

- Resolve target model + table (keep existing logic)
- Create aliased `Table` when collision detected (replaces `_usedTableNames`
  string tracking)
- Create `JoinAssociation` with the reflection
- Call `joinAssociation.joinConstraints(sourceTable, sourceKlass, OuterJoin)`
- Store the resulting `Nodes.OuterJoin` on JoinNode (new field `arelJoin`)

Delete: `_adapter`, `_resolveAdapter`, `_quoteString`, `_qt`, `_qc`,
abstract quoting imports, the PLACEHOLDER string-replace pattern,
`_addStiConstraint`.

Keep: alias tracking (collision detection), through-association routing,
`JoinNode` struct (but `joinSql: string` → `arelJoin: Nodes.OuterJoin`).

### PR 3 — Through-association Arel path (~200 LOC)

Refactor `_addThroughAssociation` to use `reflection.chain` (the reflection
chain already exists — reflection.ts has `.chain` and `joinScopes`). Rails
iterates `reflection.chain` in `JoinAssociation#join_constraints` to build
multi-hop through joins. Mirror that:

```ts
for (const [refl, table] of chain.reverse()) {
  const scope = refl.joinScope(table, foreignTable, foreignKlass);
  joins.push(new OuterJoin(table, new On(scope.arel().constraints)));
  foreignTable = table;
  foreignKlass = refl.klass;
}
```

This replaces all the manual FK/PK string-building for through associations,
including the polymorphic source_type handling and recursive through resolution.

### PR 4 — Callers: SelectManager integration (~150 LOC)

Update the two call sites:

1. **`joinConstraints()`** — currently wraps `joinSql` strings in `StringJoin`.
   After PR 2, returns stored `Nodes.OuterJoin` directly. Callers already use
   `manager.appendJoinNode()` which accepts `Join` nodes.

2. **`_buildEagerJoinManager()`** (relation.ts:3434) — currently reads
   `node.joinSql` via `manager.appendStringJoin()`. Change to
   `manager.appendJoinNode(node.arelJoin)`.

3. **`buildSelectSql()` → `selectAliases(): Nodes.As[]`** — return
   `table[column].as(aliasName)` nodes instead of SQL strings. Pass to
   `manager.project(...aliases)`.

4. **`applyColumnAliases()`** — same pattern, push `Nodes.As` via
   `relation._select!`.

### PR 5 — Cleanup (~100 LOC)

- Delete dead helper functions at bottom of file (`joinRoot`,
  `makeJoinConstraints`, `makeConstraints`, `walk`, `build`, `findReflection`)
- Remove `StringJoin` usage from eager-load paths
- Delete `joinSql` from `JoinNode` interface

## Risks / blockers

1. **`reflection.joinScope()` completeness** — currently handles direct FK
   predicates + polymorphic type + scopes. STI type constraints may need
   adding (check if `klassJoinScope` already applies the STI WHERE via
   `default_scope` on the STI subclass — Rails does this automatically).

2. **Aliased Table construction** — Rails uses `alias_tracker.aliased_table_for`
   which returns `Arel::Table.new(name, as: alias)`. Verify our `Table`
   constructor accepts an alias parameter, or add one (~5 LOC in arel package).

3. **Through-association reflection chain** — verify `reflection.chain` returns
   the full chain for multi-hop throughs. If incomplete, that's a prerequisite
   fix.

4. **`scope.arel().constraints`** — verify our Relation exposes Arel predicates
   through this path. The `whereClause.ast` should work as the constraint node.

## Non-goals

- Refactoring instantiation/hydration (`construct`, `instantiateFromRows`) —
  orthogonal to join building.
- Extracting `AliasTracker` to a separate class — can follow later.
- Changing `addNestedAssociation` control flow — only the leaf construction
  changes.
- Tree structure (`JoinBase` with children) — our flat node list works fine;
  the tree is only needed for Rails' `walk()` deduplication which we don't need
  yet.
