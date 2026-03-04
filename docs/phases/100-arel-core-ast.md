# Phase 100: Arel Core AST

## Goal

Build the foundational AST node types that represent SQL concepts. This is the
internal representation layer — nothing generates SQL yet.

## Scope

- `Arel::Table` — represents a database table
- `Arel::Attribute` — represents a column on a table
- Core AST nodes:
  - `SelectStatement`, `InsertStatement`, `UpdateStatement`, `DeleteStatement`
  - `SelectCore` (FROM, WHERE, SELECT list)
  - `JoinSource`, `InnerJoin`, `OuterJoin`
- Literal nodes: `SqlLiteral`, `Quoted`, `Casted`
- `Arel::Nodes::Node` base class

## Non-Goals

- No SQL generation (that's Phase 200)
- No predicate methods on attributes yet (Phase 300)

## Rails Reference

- https://api.rubyonrails.org/classes/Arel/Table.html
- https://api.rubyonrails.org/classes/Arel/Attributes/Attribute.html
- https://api.rubyonrails.org/classes/Arel/Nodes.html
