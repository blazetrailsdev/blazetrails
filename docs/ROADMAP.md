# Roadmap

This project is built in phases. Each phase produces a usable, tested subset of
functionality. Phase IDs are sparse (100, 200, ...) to allow inserting
intermediate phases later. Test phases (150, 250, etc.) expand test coverage
to match the behaviors validated by the Rails test suite.

## Arel (100–500)

The query-building layer. Produces SQL from a composable AST — no database
connection needed.

| Phase | Name | Status |
|-------|------|--------|
| [100](phases/100-arel-core-ast.md) | Core AST nodes | Done |
| [150](phases/150-arel-core-ast-tests.md) | Core AST — comprehensive tests | Done |
| [200](phases/200-arel-sql-visitor.md) | SQL Visitor (ToSql) | Done |
| [250](phases/250-arel-visitor-tests.md) | SQL Visitor — comprehensive tests | Done |
| [300](phases/300-arel-predicates.md) | Predicates and Expressions | Done |
| [400](phases/400-arel-select-manager.md) | SelectManager and CRUD Managers | Done |
| [450](phases/450-arel-manager-tests.md) | Managers — comprehensive tests | Done |
| [500](phases/500-arel-advanced.md) | Advanced (functions, CTEs, unions, window) | Done |

## ActiveModel (1000–1300)

The model layer without persistence. Attributes, validations, callbacks, and
serialization — everything a model needs except a database.

| Phase | Name | Status |
|-------|------|--------|
| [1000](phases/1000-activemodel-attributes.md) | Attributes and Type Casting | Done |
| [1050](phases/1050-activemodel-attributes-tests.md) | Attributes — comprehensive tests | Done |
| [1100](phases/1100-activemodel-validations.md) | Validations | Done |
| [1150](phases/1150-activemodel-validations-tests.md) | Validations — comprehensive tests | Done |
| [1200](phases/1200-activemodel-callbacks-dirty.md) | Callbacks and Dirty Tracking | Done |
| [1250](phases/1250-activemodel-callbacks-dirty-tests.md) | Callbacks & Dirty — comprehensive tests | Done |
| [1300](phases/1300-activemodel-serialization.md) | Serialization and Naming | Done |
| [1350](phases/1350-activemodel-serialization-naming-tests.md) | Serialization & Naming — comprehensive tests | Done |

## ActiveRecord (2000–2500)

The ORM layer. Connects ActiveModel to a database through Arel, adding
persistence, querying, associations, migrations, and transactions.

| Phase | Name | Status |
|-------|------|--------|
| [2000](phases/2000-activerecord-core.md) | Core and Connection | Done |
| [2100](phases/2100-activerecord-querying.md) | Querying (Relation) | Done |
| [2200](phases/2200-activerecord-associations.md) | Associations | Done |
| [2300](phases/2300-activerecord-migrations.md) | Migrations and Schema | Done |
| [2500](phases/2500-activerecord-transactions-callbacks.md) | Transactions and Callbacks | Done |

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
