# Phase 300: Arel Predicates and Expressions

## Goal

Add predicate and expression methods to `Arel::Attribute` so users can build
WHERE clauses fluently: `users[:name].eq("dean")`.

## Scope

- Comparison predicates: `eq`, `not_eq`, `gt`, `gteq`, `lt`, `lteq`
- Pattern predicates: `matches`, `does_not_match` (LIKE)
- Range predicates: `between`, `in`, `not_in`
- Null predicates: `eq(null)` producing IS NULL
- Boolean combinators: `and`, `or`, `not` (grouping nodes)
- Ordering: `asc`, `desc`
- Math expressions: `+`, `-`, `*`, `/` on attributes
- `Arel::Nodes::Grouping`

## Rails Reference

- https://api.rubyonrails.org/classes/Arel/Predications.html
- https://api.rubyonrails.org/classes/Arel/OrderPredications.html
- https://api.rubyonrails.org/classes/Arel/Math.html
