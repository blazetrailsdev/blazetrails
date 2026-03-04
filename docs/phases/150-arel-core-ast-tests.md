# Phase 150: Arel Core AST — Comprehensive Tests

## Goal

Expand test coverage for AST nodes to match behaviors validated by the Rails
Arel test suite. Cover node equality, cloning, edge cases, and the full
predication API.

## Scope

- Node equality (`==` / `hash`) for all node types
- Clone/deep-copy for SelectCore, SelectStatement, Case
- `_any` / `_all` predicate variants (eq_any, eq_all, gt_any, etc.)
- Range-based `between` / `not_between` with Infinity, beginless/endless ranges
- Empty `in([])` → always false (`1=0`); empty `notIn([])` → always true (`1=1`)
- Ascending/Descending: `reverse()`, `direction`, `isAscending()`, `isDescending()`
- SqlLiteral predication methods (`.eq()`, `.count()`)
- Table: alias deduplication, nil join no-op, empty string join error
- Attribute: type casting integration, subquery comparisons

## Rails Reference

- `activerecord/test/cases/arel/nodes/` (30+ node test files)
- `activerecord/test/cases/arel/attributes/attribute_test.rb`
- `activerecord/test/cases/arel/table_test.rb`
