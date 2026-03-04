# Phase 1050: ActiveModel Attributes — Comprehensive Tests

## Goal

Expand attribute tests to match the behaviors validated by Rails'
`attributes_test.rb` and type test suite.

## Scope

- Type casting edge cases for each type (integer truncation, boolean truthy/
  falsy sets, date parsing, decimal precision)
- Default values: static, Proc, inheritance
- Inheritance: children inherit parent attrs, can override types/defaults
- Unknown attribute raises error
- Dup produces independent copies
- Frozen model behavior
- `attributeNames` on class and instance
- Cast-value-aware dirty tracking (setting "2.3" then "2.1" on integer
  both cast to 2 = no change)

## Rails Reference

- `activemodel/test/cases/attributes_test.rb`
- `activemodel/test/cases/attributes_dirty_test.rb`
- `activemodel/test/type/` (13 type test files)
