# Phase 2300: ActiveRecord Migrations and Schema

## Goal

Implement the migration DSL for defining and evolving database schemas.

## Scope

- `ActiveRecord::Migration` base class with `up`, `down`, `change`
- Reversible migrations
- Schema definition methods: `create_table`, `drop_table`, `add_column`,
  `remove_column`, `rename_column`, `add_index`, `remove_index`,
  `change_column`, `change_column_default`
- Column types matching the Type registry
- `ActiveRecord::Schema.define` for `schema.rb`-style dumps
- Migration runner (apply, rollback, status)

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveRecord/Migration.html
- https://api.rubyonrails.org/classes/ActiveRecord/ConnectionAdapters/SchemaStatements.html
