# Roadmap

This project is built in phases. Each phase produces a usable, tested subset of
functionality. Phase IDs are sparse (100, 200, ...) to allow inserting
intermediate phases later.

## Arel (100–500)

The query-building layer. Produces SQL from a composable AST — no database
connection needed.

| Phase | Name | Status |
|-------|------|--------|
| [100](phases/100-arel-core-ast.md) | Core AST nodes | Not started |
| [200](phases/200-arel-sql-visitor.md) | SQL Visitor (ToSql) | Not started |
| [300](phases/300-arel-predicates.md) | Predicates and Expressions | Not started |
| [400](phases/400-arel-select-manager.md) | SelectManager and CRUD Managers | Not started |
| [500](phases/500-arel-advanced.md) | Advanced (functions, CTEs, unions, window) | Not started |

After Phase 500, Arel should be able to generate essentially any SQL that Rails'
Arel can, without touching a database.

## ActiveModel (1000–1300)

The model layer without persistence. Attributes, validations, callbacks, and
serialization — everything a model needs except a database.

| Phase | Name | Status |
|-------|------|--------|
| [1000](phases/1000-activemodel-attributes.md) | Attributes and Type Casting | Not started |
| [1100](phases/1100-activemodel-validations.md) | Validations | Not started |
| [1200](phases/1200-activemodel-callbacks-dirty.md) | Callbacks and Dirty Tracking | Not started |
| [1300](phases/1300-activemodel-serialization.md) | Serialization and Naming | Not started |

After Phase 1300, you can build form-backed models, validate input, track
changes, and serialize to JSON — all without a database.

## ActiveRecord (2000–2500)

The ORM layer. Connects ActiveModel to a database through Arel, adding
persistence, querying, associations, migrations, and transactions.

| Phase | Name | Status |
|-------|------|--------|
| [2000](phases/2000-activerecord-core.md) | Core and Connection | Not started |
| [2100](phases/2100-activerecord-querying.md) | Querying (Relation) | Not started |
| [2200](phases/2200-activerecord-associations.md) | Associations | Not started |
| [2300](phases/2300-activerecord-migrations.md) | Migrations and Schema | Not started |
| [2500](phases/2500-activerecord-transactions-callbacks.md) | Transactions and Callbacks | Not started |

## Future Ideas (not yet planned)

These are areas we might explore after the core is solid. No phase IDs assigned
yet — they'll get slotted in when the time comes.

- **ActiveRecord Validations integration** — wiring ActiveModel validations into
  the persistence lifecycle
- **ActiveRecord Enum** — `enum status: [:active, :archived]`
- **ActiveRecord STI** — single table inheritance
- **Adapter implementations** — SQLite, PostgreSQL, MySQL
- **Connection pooling**
- **ActiveSupport utilities** — `blank?`, `present?`, inflections, etc. (as
  needed by the other packages)
