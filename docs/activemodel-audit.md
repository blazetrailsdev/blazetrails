# ActiveModel: Rails Fidelity Audit

Comprehensive file-by-file comparison against Rails v8.0.2. Only behavioral
mismatches listed — cosmetic differences and documented TS adaptations omitted.

## Summary

| Category                     | Files  | Match | Issues |
| ---------------------------- | ------ | ----- | ------ |
| Core (attributes, callbacks) | 13     | 2     | 11     |
| Model, naming, errors, etc.  | 14     | 4     | 10     |
| Types                        | 20     | 0     | 20     |
| Validations                  | 17     | 3     | 14     |
| **Total**                    | **64** | **9** | **55** |

---

## Core (attributes, callbacks)

### access.ts — ISSUES

- Rails returns `with_indifferent_access` hash; TS returns plain Record

### api.ts — OK

### attribute-assignment.ts — ISSUES

- Rails uses `NoMethodError` exception to detect missing writers; TS uses `UnknownAttributeError`
- Missing `alias attributes= assign_attributes`

### attribute-methods.ts — ISSUES

- No `method_missing`/`attribute_missing` for dynamic dispatch; relies on pre-generated methods
- No attribute method pattern caching
- No instance `respond_to?` override for attribute methods

### attribute-mutation-tracker.ts — ISSUES

- Rails `type_cast(from/to)` on comparison; TS uses raw equality
- Rails `clone_value` checks `duplicable?`; TS only handles Date/Array/objects

### attribute-registration.ts — ISSUES

- Rails has `pending_attribute_modifications` queue applied lazily; TS applies immediately
- Missing `resolve_attribute_name`, `resolve_type_name`, `hook_attribute_type` extension points

### attribute.ts — ISSUES

- `value_for_database` doesn't re-check `type.changed_in_place?` (caches without invalidation)
- `with_type()` doesn't recurse through `with_value_from_user` if `changed_in_place?`
- `FromUser.came_from_user?` always returns `true` (Rails checks `value_constructed_by_mass_assignment?`)
- `FromUser._value_for_database` doesn't use `SerializeCastValue.serialize`
- `Uninitialized.value` returns `undefined` instead of yielding block

### attribute/user-provided-default.ts — ISSUES

- Eagerly evaluates function defaults at construction; Rails memoizes Proc lazily
- `marshal_dump` always 4-element; Rails conditionally includes value (5-element)

### attribute-set.ts — ISSUES

- Missing `frozen?` check in `write_from_user`
- Missing `freeze`, `initialize_dup`, `initialize_clone`
- Missing delegated methods (`:each_value, :fetch, :except`)

### attribute-set/builder.ts — ISSUES

- `LazyAttributeSet` is just an alias; Rails materializes on demand
- `Builder.build_from_database` doesn't return lazy set

### attribute-set/yaml-encoder.ts — ISSUES

- Completely different API: Rails uses coder-based encode/decode; TS uses string serialization

### attributes.ts — ISSUES

- `attribute()` doesn't call `define_attribute_method(name)` after registration
- `_write_attribute` is public; Rails makes it private

### callbacks.ts — ISSUES

- Missing `:only` option to limit callback types
- Only supports function callbacks; Rails also supports class-based callbacks
- After callbacks don't implicitly check `v != false`

---

## Model, naming, errors, serialization

### conversion.ts — OK

### deprecator.ts — OK

### dirty.ts — ISSUES

- `attributeChangedInPlace()` declared in interface but not implemented

### error.ts — ISSUES

- `equals()` doesn't exclude `CALLBACKS_OPTIONS` from comparison
- `details()` filters different option sets than Rails

### errors.ts — ISSUES

- `copy!`/`merge!` create new Error instances instead of updating base via `instance_variable_set`
- Missing delegated methods (`uniq!`, etc.)
- `normalize_arguments` doesn't handle proc types

### forbidden-attributes-protection.ts — OK

### lint.ts — ISSUES

- Method naming differences (camelCase vs snake_case with `?`)

### model.ts — ISSUES

- Bundles many modules; integration differs from Rails concern composition

### naming.ts — ISSUES

- `Name` doesn't implement Comparable (==, ===, <=>, to_s, to_str)
- Missing `_index` suffix on route_key for uncountable nouns
- `param_key` doesn't use namespace-aware logic
- `@singular` doesn't handle "/" replacement

### nested-error.ts — OK

### secure-password.ts — ISSUES

- `InstanceMethodsOnActivation` is a stub (only `attribute` property)
- Missing: `password_salt`, `password_challenge`, authenticate_challenge validation
- Missing: password reset token generation (`generates_token_for`)

### serialization.ts — ISSUES

- Calls `fetchValue` directly instead of `read_attribute_for_serialization`
- `serializable_add_includes` checks Maps instead of using `send(association)`

### serializers/json.ts — OK (interface only)

### translation.ts — ISSUES

- Interface-only; missing full lookup chains with namespace handling
- Missing nested attribute name handling (dots)

---

## Types

### type.ts — ISSUES

- Module-level registry setup differs (functions vs attr_accessor)

### type/value.ts — ISSUES

- Extra `equals()` method not in Rails
- No `cast_value` helper pattern (subclasses implement `cast` directly)

### type/registry.ts — ISSUES

- Can't pass constructor arguments through registry (Rails `lookup` forwards args)
- Only accepts factory functions; Rails accepts class or block

### type/string.ts — ISSUES

- Missing boolean-to-custom-string conversion (`true` → `"t"`, `false` → `"f"`)
- `cast()` just calls `String(value)` instead of Rails' specialized logic

### type/integer.ts — ISSUES

- RangeError message format differs from Rails
- `isSerializable()` missing block support for out-of-range yielding

### type/float.ts — ISSUES

- `typeCastForSchema()` returns `"NaN"` instead of `"::Float::NAN"`
- Missing `Helpers::Numeric` integration (blank strings, NaN checks, changed? behavior)

### type/decimal.ts — ISSUES

- Uses JavaScript `Number()` instead of BigDecimal — limited precision
- Missing `Helpers::Numeric` integration
- No scale handling

### type/boolean.ts — ISSUES

- Empty string `""` returns wrong value (should be nil/null, not true)
- Missing symbol value support in FALSE_VALUES

### type/date.ts — ISSUES

- Uses `new Date(String(value))` instead of ISO 8601 regex + `Date._parse`
- Missing `Helpers::Timezone` and `Helpers::AcceptsMultiparameterTime`

### type/date-time.ts — ISSUES

- Same date parsing issues as date.ts
- Missing `Helpers::Timezone`, `Helpers::AcceptsMultiparameterTime`, `Helpers::TimeValue`

### type/time.ts — ISSUES

- Missing timezone application in `userInputInTimeZone()`
- Missing all three helpers (Timezone, AcceptsMultiparameterTime, TimeValue)

### type/binary.ts — ISSUES

- Returns `Uint8Array` instead of binary string encoding
- `Data` class API differs from Rails (bytes vs to_s)

### type/big-integer.ts — ISSUES

- Doesn't inherit from Integer (missing range validation, limit handling)
- Missing `Helpers::Numeric`

### type/immutable-string.ts — ISSUES

- Missing boolean-to-custom-string conversion in `cast()`
- Missing `serialize()` override (Rails handles Numeric, Symbol, Duration)
- `type()` returns `"immutable_string"`; Rails returns `:string`

### type/serialize-cast-value.ts — ISSUES

- Simplified compatibility check (just method existence vs ancestor method ownership)
- No eager computation in `initialize()`

### type/helpers/accepts-multiparameter-time.ts — ISSUES

- Missing timezone support (`default_timezone` call)
- Builds plain JS Date instead of Ruby Time with timezone

### type/helpers/mutable.ts — ISSUES

- Passive mixin object instead of active module with `cast()` and `changed_in_place?()` overrides

### type/helpers/numeric.ts — ISSUES

- Helper functions instead of module methods that override parent class
- Missing `changed?()` complex logic (number_to_non_number, equal_nan)
- Missing `non_numeric_string?()` regex check

### type/helpers/time-value.ts — ISSUES

- Uses millisecond precision; Rails uses nanosecond precision
- Missing `serialize_cast_value()` with timezone conversion
- Missing `fast_string_to_time()` ISO parsing
- Missing `user_input_in_time_zone()` zone conversion

### type/helpers/timezone.ts — ISSUES

- Only supports "utc" or "local"; Rails reads from `Time.zone_default`
- Static variable instead of dynamic runtime config

---

## Validations

### validator.ts — ISSUES

- Missing `prepare_value_for_validation()` hook

### validations.ts — OK

### validations/absence.ts — ISSUES

- Uses `isBlank()` instead of `value.present?` (semantically inverted)

### validations/acceptance.ts — ISSUES

- Missing `allow_nil: true` default
- Default accept values differ: `[true, "true", "1", 1, "yes"]` vs Rails `["1", true]`
- Missing `setup!()` to define attributes on class

### validations/callbacks.ts — OK

### validations/clusivity.ts — ISSUES

- Missing Array value handling (`value.all?` check)
- Missing Range.cover? optimization
- Missing `:within` alias for `:in`

### validations/comparability.ts — ISSUES

- `errorOptions()` only returns `count`; Rails includes `value` and other options

### validations/comparison.ts — ISSUES

- `compare()` doesn't match Ruby's `<=>` for all types
- Missing `value.blank?` check with blank error
- No try/rescue for comparison ArgumentError

### validations/confirmation.ts — ISSUES

- Adds error to base attribute; Rails adds to `#{attr}_confirmation`
- Uses `toLowerCase()` instead of `casecmp()`
- Missing `setup!()` for confirmation attribute definition

### validations/exclusion.ts — ISSUES

- Missing `value:` in error options
- Missing `:within` alias

### validations/format.ts — ISSUES

- `:multiline` option can't suppress anchor error like Rails
- Missing `value:` in error options

### validations/inclusion.ts — ISSUES

- Missing `value:` in error options
- Missing `:within` alias

### validations/length.ts — ISSUES

- Rails extracts min/max from Range; TS uses array
- Missing `minimum: 1` when `allow_blank: false` with no constraint
- Nil-skip logic differs (Rails has special case for maximum only)
- Only handles string/array length; Rails handles any `respond_to?(:length)`

### validations/numericality.ts — ISSUES

- Uses `Number()` instead of BigDecimal with precision/scale
- Missing hexadecimal literal rejection
- Missing `value:` in error options
- `:in` uses `[min, max]` array; Rails uses Range

### validations/presence.ts — OK

### validations/resolve-value.ts — ISSUES

- Always passes record to function; Rails checks Proc arity

### validations/with.ts — ISSUES

- Always passes attribute parameter; Rails checks method arity
