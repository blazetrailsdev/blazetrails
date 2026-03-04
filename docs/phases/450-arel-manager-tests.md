# Phase 450: Arel Managers — Comprehensive Tests

## Goal

Expand manager tests to cover the full chainable API and edge cases from the
Rails SelectManager, InsertManager, UpdateManager, DeleteManager test suites.

## Scope

- SelectManager: clone independence, chaining returns, projections read/write,
  window definitions (WINDOW ... AS), lock, taken, orders, froms, source,
  distinct on, comments, compile_delete, compile_update (with subquery for limit)
- InsertManager: bulk insert (multiple rows), false/null/time values,
  select-based insert, column ordering
- UpdateManager: set with null/string, join sources, having/group with joins
- DeleteManager: chaining, limit
- All managers: symbol → SqlLiteral backward compat, string → SqlLiteral

## Rails Reference

- `activerecord/test/cases/arel/select_manager_test.rb`
- `activerecord/test/cases/arel/insert_manager_test.rb`
- `activerecord/test/cases/arel/update_manager_test.rb`
- `activerecord/test/cases/arel/delete_manager_test.rb`
