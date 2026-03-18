# ActiveRecord: Road to 100% Test Coverage

Current state: **52.2%** (4,374 / 8,385 tests). 3,767 skipped, 52 wrong describes, 244 unmatched.

## How coverage is measured

`npm run convention:compare` matches our test names against the Rails test suite. `OK` = passing, `Skip` = `it.skip` stub, `Desc` = wrong describe block, `Miss` = no TS equivalent.

## Two workstreams

The remaining 4,011 tests split cleanly into two parallel tracks that rarely touch the same files.

### Workstream A: Associations & Querying (~815 skipped)

Covers association features, eager loading, scoping, where clauses, and finders.

| File                                                             | Skipped | Notes                               |
| ---------------------------------------------------------------- | ------- | ----------------------------------- |
| associations/has-many-through-associations.test.ts               | 98      | Largest association file            |
| associations/eager.test.ts                                       | 76      | includes/preload, 20 unmatched      |
| associations.test.ts                                             | 72      | General association tests           |
| autosave-association.test.ts                                     | 68      | Autosave edge cases                 |
| associations/nested-through-associations.test.ts                 | 54      | Nested through                      |
| scoping/relation-scoping.test.ts                                 | 53      | Scoping + finders, 1 wrong describe |
| associations/has-and-belongs-to-many-associations.test.ts        | 48      | HABTM                               |
| associations/join-model.test.ts                                  | 43      | Join models                         |
| relation/where.test.ts                                           | 36      | Where clause features               |
| associations/inverse-associations.test.ts                        | 35      | Inverse of                          |
| associations/has-one-associations.test.ts                        | 31      | Has-one features                    |
| associations/has-one-through-associations.test.ts                | 29      | Has-one-through                     |
| associations/has-many-through-disable-joins-associations.test.ts | 28      | Disable joins                       |
| nested-attributes.test.ts                                        | ~18     | 18 wrong describes to fix           |

#### Key capabilities to implement

- **Through associations**: has-many-through, has-one-through, nested-through — the biggest chunk
- **Eager loading**: `includes`, `preload`, `eagerLoad` — partially done (#114)
- **Scoping**: `scoping()` integration with finders, default scopes, unscoped
- **Where clause**: `where.not`, `where.associated`, `where.missing`, OR/AND chaining
- **HABTM**: join table management, bidirectional syncing
- **Autosave**: nested attribute saving, validation propagation, destroy marking

---

### Workstream B: Core ORM & Infrastructure (~2,950 skipped)

Covers base class features, adapters, fixtures, schema, encryption, and connections.

| File                                                             | Skipped | Notes                        |
| ---------------------------------------------------------------- | ------- | ---------------------------- |
| fixtures.test.ts                                                 | 149     | Fixture loading/caching      |
| base.test.ts                                                     | 69      | Core Base class features     |
| query-cache.test.ts                                              | 62      | Query caching layer          |
| adapters/postgresql/postgresql-adapter.test.ts                   | 51      | PG adapter                   |
| encryption/encryptable-record.test.ts                            | 51      | Encrypted attributes         |
| adapters/trilogy/trilogy-adapter.test.ts                         | 51      | MySQL adapter                |
| connection-pool.test.ts                                          | 50      | Connection pooling           |
| migration.test.ts                                                | 50      | Migration features           |
| adapters/postgresql/range.test.ts                                | 46      | PG range type                |
| adapters/postgresql/hstore.test.ts                               | 44      | PG hstore, 3 wrong describes |
| adapters/postgresql/array.test.ts                                | 41      | PG array type                |
| insert-all.test.ts                                               | 42      | Insert all / upsert          |
| reflection.test.ts                                               | 40      | Reflection API               |
| connection-adapters/merge-and-resolve-default-url-config.test.ts | 40      | DB config                    |
| adapters/postgresql/schema.test.ts                               | 39      | PG schema                    |
| unsafe-raw-sql.test.ts                                           | 37      | SQL sanitization             |
| multiparameter-attributes.test.ts                                | 37      | Multi-param attrs            |
| adapters/postgresql/postgresql-rake.test.ts                      | 37      | PG rake tasks                |
| migrator.test.ts                                                 | 35      | Migrator                     |
| strict-loading.test.ts                                           | 34      | Strict loading modes         |
| schema-dumper.test.ts                                            | 67      | Schema dumper                |
| tasks/database-tasks.test.ts                                     | 78      | DB tasks                     |

#### Key capabilities to implement

- **PostgreSQL types**: range, hstore, array, geometric, cidr/inet — ~250 skipped across PG files
- **Base class**: attribute API, type casting, inheritance, abstract classes
- **Fixtures**: loading, caching, transactional fixtures
- **Query cache**: caching layer, invalidation, notification hooks
- **Schema/migrations**: DDL generation, schema dumper, migrator
- **Encryption**: encrypted attributes, key management, querying encrypted columns
- **Connections**: pooling, switching, resolver, multi-DB

---

### Shared / small items (52 wrong describes)

These can be picked up by either workstream as they touch the relevant files:

- nested-attributes.test.ts (18 wrong describes)
- PostgreSQL adapter files (26 wrong describes across ~12 files)
- scoping/relation-scoping.test.ts (1 wrong describe)
- associations/nested-error.test.ts (3 wrong describes)

---

## Tracking

```bash
npm run convention:compare -- --package activerecord
```

Target: `activerecord — 8385/8385 tests (100%)`
