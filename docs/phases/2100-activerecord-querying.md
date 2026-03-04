# Phase 2100: ActiveRecord Querying (Relation)

## Goal

Implement `ActiveRecord::Relation` — the lazy, chainable query interface that
delegates to Arel under the hood.

## Scope

- `ActiveRecord::Relation` with lazy evaluation
- Query methods: `where`, `order`, `limit`, `offset`, `select`, `distinct`,
  `group`, `having`, `joins`, `includes`, `reorder`, `reverse_order`
- `all`, `none`, `unscoped`
- Terminal methods: `to_a`, `first`, `last`, `count`, `sum`, `average`,
  `minimum`, `maximum`, `pluck`, `ids`, `exists?`
- Scopes: `scope` class method
- Chaining and merging relations

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveRecord/Relation.html
- https://api.rubyonrails.org/classes/ActiveRecord/QueryMethods.html
- https://api.rubyonrails.org/classes/ActiveRecord/Calculations.html
- https://api.rubyonrails.org/classes/ActiveRecord/Scoping/Named.html
