# Phase 500: Arel Advanced Features

## Goal

Round out Arel with functions, subqueries, window functions, CTEs, and UNION
so the package covers the full breadth of what Rails' Arel supports.

## Scope

- `Arel::Nodes::NamedFunction` and built-in functions (COUNT, SUM, AVG, etc.)
- `Arel.star` (`*` projection)
- Subqueries (using a SelectManager as a value)
- `UNION`, `UNION ALL`, `INTERSECT`, `EXCEPT`
- Window functions: `Arel::Nodes::Window`, `OVER`, `PARTITION BY`
- Common Table Expressions (`WITH`)
- `Arel.sql()` escape hatch for raw SQL

## Rails Reference

- https://api.rubyonrails.org/classes/Arel/Nodes/NamedFunction.html
- https://api.rubyonrails.org/classes/Arel.html
