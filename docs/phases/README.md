# Implementation Phases

Phases are numbered with sparse IDs (100, 200, ...) to allow insertion of
intermediate phases. Each phase should produce a usable, tested subset of
functionality.

## Current Coverage (as of 2026-03-06)

| Package | Rails Tests | Matched | Coverage |
|---------|-------------|---------|----------|
| Arel | 592 | 592 | **100%** |
| ActiveModel | 771 | 771 | **100%** |
| ActiveRecord | 5428 | 742 | **13.7%** |
| **Overall** | **6791** | **2105** | **31%** |

## ActiveRecord Coverage by Area

| Area | Matched | Total | Coverage | Phase |
|------|---------|-------|----------|-------|
| Callbacks | 14 | 31 | 45% | — |
| Finders | 138 | 377 | 37% | 100 |
| Persistence | 67 | 202 | 33% | 100 |
| Calculations | 71 | 233 | 30% | 100 |
| Relations | 168 | 604 | 28% | 200 |
| Core | 158 | 1295 | 12% | 200 |
| Scoping | 28 | 233 | 12% | 300 |
| Inheritance | 8 | 73 | 11% | 300 |
| Enum | 10 | 97 | 10% | 300 |
| Store | 5 | 50 | 10% | 300 |
| Locking | 5 | 51 | 10% | 400 |
| Transactions | 16 | 155 | 10% | 400 |
| Migrations | 5 | 118 | 4% | 500 |
| Attributes | 12 | 372 | 3% | 200 |
| Associations | 35 | 1440 | 2% | 600–800 |
| Validations | 2 | 97 | 2% | 300 |

## Phase Order

| Phase | Focus | Est. Tests | Target |
|-------|-------|-----------|--------|
| 100 | [Finders, Persistence, Calculations](100-finders-persistence-calculations.md) | ~400 | 20% |
| 200 | [Relations, Core, Attributes](200-relations-core-attributes.md) | ~600 | 35% |
| 300 | [Scoping, Inheritance, Enum, Store, Validations](300-scoping-enum-inheritance.md) | ~300 | 40% |
| 400 | [Transactions, Locking](400-transactions-locking.md) | ~150 | 43% |
| 500 | [Migrations](500-migrations.md) | ~100 | 45% |
| 600 | [Associations: belongs_to, has_one](600-associations-basic.md) | ~250 | 50% |
| 700 | [Associations: has_many, has_many :through](700-associations-has-many.md) | ~500 | 60% |
| 800 | [Associations: eager loading, autosave, nested](800-associations-advanced.md) | ~600 | 70% |
| 900 | [CI, Publishing, Documentation](900-ci-publishing.md) | — | — |
