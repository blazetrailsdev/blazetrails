# Phase 2500: ActiveRecord Transactions and Callbacks

## Goal

Add transaction support and the full ActiveRecord callback lifecycle.

## Scope

- `ActiveRecord::Transactions` — `transaction`, `after_commit`,
  `after_rollback`
- Nested transactions / savepoints
- Full callback chain: `before_save`, `after_save`, `before_create`,
  `after_create`, `before_update`, `after_update`, `before_destroy`,
  `after_destroy`, `after_commit`, `after_rollback`
- `around_*` callbacks

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveRecord/Transactions.html
- https://api.rubyonrails.org/classes/ActiveRecord/Callbacks.html
