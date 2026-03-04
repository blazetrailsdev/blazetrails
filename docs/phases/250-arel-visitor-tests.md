# Phase 250: Arel SQL Visitor — Comprehensive Tests

## Goal

Expand ToSql visitor tests to match the edge cases validated by Rails'
`visitors/to_sql_test.rb`.

## Scope

- Nil → IS NULL / IS NOT NULL at visitor level
- Boolean `false` and `true` handling
- String escaping in equality
- Empty IN → `1=0`, empty NOT IN → `1=1`
- Range-based IN (two-dot → BETWEEN, three-dot → >= AND <)
- Infinity-bounded ranges
- Grouping: nested groupings produce single layer of parens
- Not: applies to whole And expressions
- LIMIT/OFFSET quoting
- Subquery as join source
- Case expressions (CASE WHEN ... THEN ... ELSE ... END)
- Comments (/* ... */)
- BindParam → `?`
- Named functions with DISTINCT
- Window functions: ROWS/RANGE frame bounds
- CTE with MATERIALIZED/NOT MATERIALIZED
- Union parenthesis squashing

## Rails Reference

- `activerecord/test/cases/arel/visitors/to_sql_test.rb`
