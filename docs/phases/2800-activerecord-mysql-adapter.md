# Phase 2800: ActiveRecord MySQL Adapter

## Goal

Implement a MySQL/MariaDB adapter using the `mysql2` package.

## Scope

- `MysqlAdapter` implementing the `DatabaseAdapter` interface
- Connection management with URI or config object
- Connection pooling via mysql2's built-in pool
- Real transaction and savepoint support
- Parameterized queries with `?` bind syntax (native to mysql2)
- AUTO_INCREMENT handling for insert ID return

## Dependencies

- `mysql2` npm package

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveRecord/ConnectionAdapters/Mysql2Adapter.html
