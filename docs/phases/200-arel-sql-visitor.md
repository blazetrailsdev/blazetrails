# Phase 200: Arel SQL Visitor (ToSql)

## Goal

Implement the Visitor pattern to walk the AST and produce SQL strings. This is
how Arel turns its tree into executable queries.

## Scope

- `Arel::Visitors::Visitor` base class
- `Arel::Visitors::ToSql` — the main SQL-generating visitor
- `Arel::Collectors::SQLString` — collects SQL fragments
- `Arel::Collectors::Bind` — collects bind parameters separately
- Generate valid SQL for SELECT, INSERT, UPDATE, DELETE from Phase 100 AST nodes

## Rails Reference

- https://api.rubyonrails.org/classes/Arel/Visitors/ToSql.html
- https://api.rubyonrails.org/classes/Arel/Collectors.html
