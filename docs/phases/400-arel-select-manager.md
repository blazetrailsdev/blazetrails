# Phase 400: Arel SelectManager and CRUD Managers

## Goal

Implement the manager classes that provide the chainable query-building API.
These are the objects users actually interact with.

## Scope

- `Arel::SelectManager` — `from`, `project`, `where`, `order`, `take`, `skip`,
  `join`, `on`, `group`, `having`, `distinct`
- `Arel::InsertManager` — `into`, `insert`, `values`
- `Arel::UpdateManager` — `table`, `set`, `where`
- `Arel::DeleteManager` — `from`, `where`
- `Arel::Table#from` returning a SelectManager
- `Arel::Table#project` shorthand

## Rails Reference

- https://api.rubyonrails.org/classes/Arel/SelectManager.html
- https://api.rubyonrails.org/classes/Arel/InsertManager.html
- https://api.rubyonrails.org/classes/Arel/UpdateManager.html
- https://api.rubyonrails.org/classes/Arel/DeleteManager.html
