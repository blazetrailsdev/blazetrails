# Phase 1150: ActiveModel Validations — Comprehensive Tests

## Goal

Expand validation tests to match the behaviors validated by Rails' extensive
validation test suite (17 test files).

## Scope

- Presence: whitespace-only is blank, `allowNil`, `allowBlank`
- Length: infinite ranges, UTF-8 character counting, dynamic max via
  Proc/Lambda/Symbol, `minimum: 0` rejects nil, custom messages with `%{count}`
- Numericality: junk value list, BigDecimal, Infinity, `onlyInteger`,
  dynamic thresholds, `odd`/`even`, combined constraints
- Inclusion/Exclusion: ranges (string, time, date), Lambda with model,
  array-valued attributes, `within` alias
- Format: anchor enforcement (reject `^`/`$`), `without` option, dynamic regex
- Acceptance: nil vs empty string distinction, multiple accept values
- Confirmation: nil confirmation = valid, case sensitivity option
- Absence: inverse of presence
- Conditional: `:if`/`:unless` with method/Proc/array, combined conditions
- Contexts: `:on`/`:except_on`, multiple contexts
- `validate!` strict mode (raises on invalid)
- Validation order preservation
- Proc messages (0-arg, 1-arg, 2-arg)

## Rails Reference

- `activemodel/test/cases/validations/` (17 test files)
