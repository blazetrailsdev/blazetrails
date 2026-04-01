# ActiveModel: Road to 100%

Current state: **64.5%** API (222 / 344 methods). **100%** tests (963/963).

```bash
pnpm run api:compare -- --package activemodel
pnpm run api:compare -- --package activemodel --missing
```

---

## 19 fully matched files

access, api, attribute assignment, attribute mutation tracker, conversion, error, nested error, serialization, serializers/json, type helpers (5), type/registry, validations (callbacks, comparability, resolve value, with).

## Biggest gaps (129 missing methods)

| Area             | Missing | Notes                                                                                       |
| ---------------- | ------- | ------------------------------------------------------------------------------------------- |
| Types            | ~20     | date, datetime, decimal, float, string, time, big_integer — `castValue`/`serialize` methods |
| Validations      | ~15     | comparison, format, inclusion, exclusion, clusivity — validator methods                     |
| Core type system | ~10     | type.rb registry methods                                                                    |
| Attributes       | ~10     | attribute registration, definition                                                          |
| Dirty tracking   | ~8      | changes applied, previous changes                                                           |
| Callbacks        | ~5      | define_callbacks, run_callbacks                                                             |
| Model            | ~5      | naming, translation                                                                         |
| Other            | ~56     | scattered across 30+ files with 1-2 missing each                                            |

Most gaps are in type casting methods (`castValue`, `serialize`, `deserialize`, `isChangedInPlace`) that repeat across type classes, and validator-specific methods.
