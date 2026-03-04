# Phase 1100: ActiveModel Validations

## Goal

Implement the validation framework so models can declare constraints and check
validity.

## Scope

- `ActiveModel::Validations` mixin
- `validates`, `validate` (custom method validators)
- Built-in validators:
  - `presence`, `absence`
  - `length` (minimum, maximum, is, in)
  - `numericality` (greater_than, less_than, equal_to, odd, even, etc.)
  - `inclusion`, `exclusion`
  - `format` (with regex)
  - `acceptance`, `confirmation`
- `valid?`, `invalid?`, `errors`
- `ActiveModel::Errors` — `add`, `full_messages`, `[]`, `where`
- Conditional validations: `if`, `unless` options

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveModel/Validations.html
- https://api.rubyonrails.org/classes/ActiveModel/Errors.html
