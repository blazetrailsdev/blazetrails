# Phase 1250: ActiveModel Callbacks & Dirty — Comprehensive Tests

## Goal

Expand callback and dirty tracking tests to match Rails behavior.

## Scope

### Callbacks
- `:abort` throw halts chain; `false` return does NOT halt
- After callbacks don't run if action block returns `false`
- Callback ordering (declared order = execution order)
- `only:` option restricts callback types
- `:if` condition on callbacks
- Context-specific callbacks (`:on`)

### Dirty
- `changed?`, `changedAttributes`, `changes`
- `attributeChanged(from:, to:)` with specific values
- Multiple changes to same attribute retains first original value
- `clearChangesInformation` resets everything
- Selective `restoreAttributes(["name"])`
- Cast-value-aware change detection (integer "2.3" → 2, "2.1" → 2 = no change)
- `previouslyChanged`
- Dup independence

## Rails Reference

- `activemodel/test/cases/callbacks_test.rb`
- `activemodel/test/cases/dirty_test.rb`
- `activemodel/test/cases/attributes_dirty_test.rb`
