# Arel: Rails Fidelity Audit

Comprehensive file-by-file comparison against Rails v8.0.2. Only behavioral
mismatches listed — cosmetic differences and documented TS adaptations omitted.

## Summary

| Category                      | Files  | Match  | Issues |
| ----------------------------- | ------ | ------ | ------ |
| Core (managers, predications) | 17     | 11     | 6      |
| Nodes                         | 52     | 13     | 39     |
| Visitors & Collectors         | 12     | 5      | 7      |
| **Total**                     | **81** | **29** | **52** |

---

## Core (managers, predications)

### alias-predication.ts — OK

### crud.ts — OK

### errors.ts — OK

### expressions.ts — OK

### filter-predications.ts — OK

### insert-manager.ts — OK

### math.ts — OK

### order-predications.ts — OK

### table.ts — OK

### tree-manager.ts — OK

### window-predications.ts — OK

### attributes/attribute.ts — ISSUES

- `notEq()` doesn't call `castValue(other)` but `eq()` does — inconsistent
- `extract(field)` passes `this` directly; Rails passes `[self]` as array

### delete-manager.ts — ISSUES

- `group()` pushes raw nodes; Rails wraps columns in `Group` nodes

### factory-methods.ts — ISSUES

- Missing: `createTrue`, `createFalse`, `createAnd`, `createOn`, `lower`, `coalesce`, `cast`

### predications.ts — ISSUES

- Missing: `matchesRegexp`, `doesNotMatchRegexp`, `does_not_match_any/all` variants

### select-manager.ts — ISSUES

- `group()` doesn't wrap columns in `Group` nodes
- `as()` doesn't wrap AST in `grouping()` before creating TableAlias

### update-manager.ts — ISSUES

- `group()` doesn't wrap columns in `Group` nodes

---

## Nodes

### node.ts — OK

### equality.ts — OK

### in.ts — OK

### terminal.ts — OK

### inner-join.ts — OK

### outer-join.ts — OK

### full-outer-join.ts — OK

### right-outer-join.ts — OK

### leading-join.ts — OK

### cte.ts — OK

### update-statement.ts — OK

### false.ts — OK

### true.ts — OK

### binary.ts — ISSUES

- Missing `hash()` and `eql()` overrides
- `As.toCte()` uses right as value; Rails uses `left.name`

### unary.ts — ISSUES

- Missing `hash()` and `eql()` overrides
- Missing `value` alias for `expr`

### nary.ts — ISSUES

- `fetchAttribute` returns boolean instead of executing block on children
- Missing `hash()` and `eql()` overrides

### and.ts — ISSUES

- Extends `Node` directly; Rails extends `Nary` — missing inherited behavior

### or.ts — ISSUES

- Overloaded constructor with runtime validation not in Rails

### homogeneous-in.ts — ISSUES

- `procForBinds` returns null; Rails returns lambda creating `ActiveModel::Attribute`
- Missing `fetchAttribute` logic that checks `expr` fallback

### matches.ts — ISSUES

- Doesn't apply `Nodes.build_quoted` to escape parameter

### function.ts — ISSUES

- Accepts `Node[]` expressions; Rails accepts singular `expr`
- Missing `hash()` and `eql()` overrides

### named-function.ts — ISSUES

- Standalone Node with extra math ops; Rails just extends Function with name

### count.ts — ISSUES

- Normalizes expr to array; Rails keeps as-is

### case.ts — ISSUES

- `when()` returns new Case with cloned conditions; Rails mutates in-place
- `else()` wrapping logic differs from Rails' `Else.new(Nodes.build_quoted(expression))`
- Missing `When`/`Then` node wrapping for condition/result pairs

### ascending.ts — ISSUES

- Extends `Unary` directly; Rails extends `Ordering`

### descending.ts — ISSUES

- Extends `Unary` directly; Rails extends `Ordering`

### ordering.ts — ISSUES

- `NullsFirst`/`NullsLast` extend `Ordering`; Rails has them extend `Unary`

### grouping.ts — ISSUES

- Extends `Node` directly; Rails extends `Unary`

### select-statement.ts — ISSUES

- Has `comment` attribute; Rails `SelectStatement` does not

### select-core.ts — ISSUES

- `optimizerHints` initialized as `[]`; Rails initializes as nil
- Constructor doesn't take relation param

### insert-statement.ts — ISSUES

- Constructor doesn't take relation param

### delete-statement.ts — ISSUES

- Constructor doesn't take relation/wheres params

### sql-literal.ts — ISSUES

- `join()` returns Fragments; Rails uses `+` operator

### bind-param.ts — ISSUES

- `isUnboundable()` returns false; Rails checks `respond_to?` on value

### casted.ts — ISSUES

- `Quoted` is standalone; Rails `Quoted` extends `Unary`
- `Quoted.isInfinite()` returns 1/-1; Rails uses `respond_to?` check

### window.ts — ISSUES

- `order`/`partition` don't auto-convert strings to SqlLiteral
- `Rows`/`Range`/`Preceding`/`Following` extend `Node`; Rails extends `Unary`

### over.ts — ISSUES

- Extends `Node`; Rails extends `Binary`

### extract.ts — ISSUES

- Extends `Node`; Rails extends `Unary`

### table-alias.ts — ISSUES

- Extends `Node`; Rails extends `Binary`
- `get()` returns SqlLiteral; Rails returns `Attribute.new(self, name)`

### comment.ts — ISSUES

- Constructor takes variadic `...values`; Rails takes single value/array

### with.ts — ISSUES

- Extends `Node`; Rails extends `Unary`

### join-source.ts — ISSUES

- Method naming: `isEmpty()` vs Rails `empty?`

### string-join.ts — ISSUES

- Constructor doesn't match Rails' `init(left, right = nil)` signature

### values-list.ts — ISSUES

- Extends `Node` with `rows`; Rails extends `Unary` with `rows` alias to `expr`

### infix-operation.ts — ISSUES

- Operator is string; Rails uses symbol

### unary-operation.ts — ISSUES

- Operator is string; Rails uses symbol

### filter.ts — ISSUES

- Extends `Node`; Rails extends `Binary`
- Has `over()` method not in Rails

### regexp.ts — ISSUES

- `caseSensitive` camelCase; Rails `case_sensitive` (property naming only)

### fragments.ts — ISSUES

- `join()` returns new Fragments; Rails uses `+` operator

### bound-sql-literal.ts — ISSUES

- Error message format differs from Rails `BindError`
- Always stores both positional and named; Rails stores one or nil

### unqualified-column.ts — ISSUES

- Missing `attribute=` setter

---

## Visitors & Collectors

### visitors/visitor.ts — OK

### visitors/postgresql.ts — OK

### collectors/bind.ts — OK

### collectors/plain-string.ts — OK

### collectors/substitute-binds.ts — OK

### visitors/to-sql.ts — ISSUES

- Missing `prepare_update_statement()` / `prepare_delete_statement()` transforms
- Missing DELETE with JOINs handling ("DELETE table FROM" syntax)
- `visitComment()` doesn't sanitize values (SQL injection risk)
- Missing `HomogeneousIn` node support
- Uses hardcoded double quotes instead of `quote_table_name()`/`quote_column_name()`

### visitors/mysql.ts — ISSUES

- Missing `visitNullsFirst()`/`visitNullsLast()` override (MySQL needs "IS NOT NULL, column" syntax)
- Missing `visitSelectCore()` DUAL table for empty sources
- `visitCte()` doesn't use adapter-specific quoting

### visitors/sqlite.ts — ISSUES

- Missing `visitLock()` override (SQLite ignores locks)
- Missing `visitInfixValueWithParen()` for UNION parentheses rules

### visitors/dot.ts — ISSUES

- Completely different implementation — missing edge tracking, 20+ visit method overrides
- Output format differs (simplified vs full edge graph)

### collectors/composite.ts — ISSUES

- Missing `preparable` property propagation between left/right

### collectors/sql-string.ts — ISSUES

- `preparable` defaults to false instead of being unset

### collectors/substitute-bind-collector.ts — ISSUES

- `addBind()` doesn't call `value_for_database()` before quoting
- TS-only class with no direct Rails equivalent
