# Phase 1350: ActiveModel Serialization & Naming — Comprehensive Tests

## Goal

Expand serialization and naming tests to match Rails behavior.

## Scope

### Serialization
- `:only`, `:except`, `:methods` (with key ordering preserved)
- Non-existing method raises error
- `:include` for associations (singular and plural)
- Nested includes with options
- JSON: `toJson` with root, `fromJson`, custom `asJson` override

### Naming
- Basic: singular, plural, element, collection, paramKey, routeKey, i18nKey
- CamelCase → snake_case underscore conversion
- Namespace handling (isolated and shared)
- Uncountable nouns (e.g., "sheep")
- Instance delegates to class

### Conversion
- `toParam` returns null for new, string for persisted
- `toPartialPath` with namespacing

## Rails Reference

- `activemodel/test/cases/serialization_test.rb`
- `activemodel/test/cases/serializers/json_serialization_test.rb`
- `activemodel/test/cases/naming_test.rb`
- `activemodel/test/cases/conversion_test.rb`
