# activemodel post-100% follow-up plan

`pnpm api:compare --package activemodel` reached **433/433 (100%)** on
2026-04-29 via PRs #971 / #974 / #978 / #982 / #988 / #989. Public
surface is done. This doc tracks the four follow-up tracks that
remain — privates, the validator-internal `resolveValue` consumption
gap, the small `test:compare` gap, and the `readAttribute` Rails-parity
refactor.

Read the Rails source before each PR. Don't paraphrase from memory.
Per CLAUDE.md: ≤ 300 LOC per PR, draft, branch from `main`, no
subagents, no `Co-Authored-By` lines.

Rails reference: `scripts/api-compare/.rails-source/activemodel/`.

## Current state

```
pnpm api:compare --package activemodel              → 433/433 (100%)
pnpm api:compare --privates --package activemodel   → 477/607 (78.6%)  (was 454/607 74.8%)
pnpm test:compare --package activemodel             → 959/963 (99.6%)
```

The privates view is what surfaces internal Rails behaviors that the
public view doesn't enforce. Most of the validator-family
`resolveValue` consumption gap from PR #971 is captured here as
unported privates (`Clusivity#delimiter`, `Format#recordError`,
`Numericality#optionAsNumber`, etc.) — porting the privates _forces_
the consumption call site to materialize.

### Track A is functionally complete

All Track A PRs are merged. The remaining 10 "misses" the privates
view shows on validator files (Confirmation 2, Acceptance 2,
Callbacks 2, Numericality 4) are an **api-compare extractor
limitation, not unported code**: A4/A5 used the
`declare X: typeof X` + `Validator.prototype.X = X` attachment
pattern (required because `EachValidator`'s constructor invokes
`this.checkValidity()` before subclass class fields initialize), and
`extract-ts-api.ts` doesn't recognize `declare`-only class fields as
methods. Closing the residual 10 misses on the report is a tooling
fix on `scripts/api-compare/extract-ts-api.ts`, not additional
porting. Tracked as **Track A6** below.

---

## Track A — Validator privates port

Closes the issue first surfaced in PR #971: validators got
`resolveValue` attached as a mixin method, but their own dispatch logic
doesn't call it where Rails does. The privates view exposes exactly
which helpers are missing. Each PR is one Rails source file → one
trails source file.

| File                          | Privates today | Status                                                                                      |
| ----------------------------- | -------------: | ------------------------------------------------------------------------------------------- |
| `validations/clusivity.rb`    |   5/5 (100%) ✓ | done — A1                                                                                   |
| `validations/exclusion.rb`    |   6/6 (100%) ✓ | done — A1 (via Clusivity)                                                                   |
| `validations/inclusion.rb`    |   6/6 (100%) ✓ | done — A1 (via Clusivity)                                                                   |
| `validations/format.rb`       |   6/6 (100%) ✓ | done — A2                                                                                   |
| `validations/length.rb`       |   5/5 (100%) ✓ | done — A3                                                                                   |
| `validations/numericality.rb` |    11/15 (73%) | done in source — A4a/A4b (PRs #1015, #1026); 4 misses are extractor false negatives, see A6 |
| `validations/confirmation.rb` |      2/4 (50%) | done in source — A5 (PR #1028); 2 misses are extractor false negatives, see A6              |
| `validations/acceptance.rb`   |      2/4 (50%) | done in source — A5 (PR #1028); 2 misses are extractor false negatives, see A6              |
| `validations/callbacks.rb`    |      2/4 (50%) | done in source — A5 (PR #1028); 2 misses are extractor false negatives, see A6              |

### PR A1 — Clusivity (cascades to Inclusion + Exclusion) — ✅ done

Rails refs:

- `validations/clusivity.rb:14-43`. `delimiter` is `options[:in] || options[:within]`. `include?(record, value)` does the membership test, calling `resolve_value(record, delimiter)` at line 22. `inclusion_method(enumerable)` chooses `:include?` vs `:cover?` based on Range vs Array.

Trails files: `clusivity.ts`, `inclusion.ts`, `exclusion.ts`.

Changes:

1. Port `delimiter` as a private getter on the host (Inclusion / Exclusion validators) — call site for `this.resolveValue(record, this.delimiter)`.
2. Port `include?` (TS: `isInclude`) — replaces inline membership logic in `inclusion.ts` / `exclusion.ts`.
3. Port `inclusionMethod` — Range detection. Trails has no Range type yet; for now, treat any iterable that isn't an Array as the "cover" path. Document the gap if Range becomes a concern.

Closes the Clusivity / Inclusion / Exclusion `resolveValue` consumption gap.

### PR A2 — Format — ✅ done

Rails refs: `validations/format.rb:8-58`. `record_error` is the shared error-add helper. `check_options_validity` validates `:with` / `:without` mutual exclusion + multiline-anchor check. `regexp_using_multiline_anchors?` is the safety check.

Changes:

1. Port the three privates with their Rails signatures.
2. Rewire `validateEach` to call `this.resolveValue(record, options.with)` and `this.resolveValue(record, options.without)` per `format.rb:12,15` — drops the existing `resolveRegexp` private.

Closes the Format `resolveValue` consumption gap.

### PR A3 — Length — ✅ done

Rails ref: `validations/length.rb:55, 69`. `skip_nil_check?(key)` returns true when the option allows nil. `validate_each` line 55 calls `resolve_value(record, check_value)`.

Changes:

1. Port `skipNilCheck`.
2. Rewire `validateEach` to call `this.resolveValue(record, checkValue)` per Rails. Drops the inline `resolveNum`.

Closes the Length `resolveValue` consumption gap. Smallest PR in the track.

### PR A4a — Numericality coercion pipeline — ✅ done (PR #1015)

Rails refs: `validations/numericality.rb:68-117`.

Privates: `option_as_number`, `parse_as_number`, `parse_float`, `round`, `is_number?`, `is_integer?`, `is_hexadecimal_literal?`.

`option_as_number(record, option_value, precision, scale)` is
`parse_as_number(resolve_value(record, option_value), precision, scale)`
— this is the call site that closes the Numericality `resolveValue`
consumption gap.

Note name collisions in the api-compare conventions: `is_number?` →
`isIsNumber`, `is_integer?` → `isIsInteger`, `is_hexadecimal_literal?`
→ `isIsHexadecimalLiteral` (the conventions doubler appends `is`
prefix to predicate methods that already start with `is_`). Verify
against `scripts/api-compare/conventions.ts` before naming.

### PR A4b — Numericality dispatch helpers — ✅ done (PR #1026)

Privates: `filtered_options`, `allow_only_integer?`,
`prepare_value_for_validation`, `record_attribute_changed_in_place?`.

`prepare_value_for_validation` is Rails' Float / BigDecimal cast hook
for AR; in AM it's a near-passthrough. Faithful port + wire into
`validateEach`.

Split from A4a because numericality is dense; A4a is the substantive
behavior change, A4b is the surface fill.

### PR A5 — Confirmation + Acceptance + Callbacks bundle — ✅ done (PR #1028)

Three small files, ~2 privates each. Ports landed in #1028 with
`setupBang` + `isConfirmationValueEqual` (Confirmation),
`setupBang` + `isAcceptableOption` (Acceptance), and
`setOptionsForCallback` + `runValidationsBang` (Callbacks). Shared
`inspectAccessor` helper extracted to `validations/_accessor.ts`
during review. The privates report still lists these as misses — see
A6.

### PR A6 — api-compare extractor: recognize `declare`-attached privates

**Tooling-only PR, no source changes.** The validator-bundle ports
(A4a/A4b/A5) attach Rails-private helpers via:

```ts
class XValidator extends EachValidator {
  declare myHelper: typeof myHelper;
}
export function myHelper(this: ...) { ... }
XValidator.prototype.myHelper = myHelper;
```

This pattern is required because `EachValidator`'s constructor calls
`this.checkValidity()` before subclass class-field initializers run
(JS bootstrapping order), so plain class fields can't be used.
`scripts/api-compare/extract-ts-api.ts` walks class members but
treats `declare`-only fields as type-only and excludes them, so the
prototype-attached helpers don't appear in the trails-side method
set. As a result, 10 helpers (4 Numericality + 2×3 in the validator
bundle) read as missed despite being implemented and exported.

Changes:

1. In `extract-ts-api.ts`, when a class member is a `declare`-typed
   field whose type is `typeof <ident>` and `<ident>` matches a
   top-level exported function in the same file, register the field
   as a method on the class.
2. (Optional) Recognize the corresponding
   `Class.prototype.X = X` / `Class.prototype.X = function ...`
   assignment as a secondary signal so the heuristic doesn't fire on
   purely type-side declarations.
3. Add a unit test in `extract-ts-api.test.ts` covering both the
   `declare typeof` field and the prototype-assignment pattern.

Expected delta: +10 matches across `validations/numericality.ts`,
`validations/confirmation.ts`, `validations/acceptance.ts`,
`validations/callbacks.ts`. Pushes activemodel privates from 477/607
(78.6%) to ~487/607 (~80.2%).

**Track A target:** validator family privates effectively at 100%
(modulo A6 tooling fix). The "validators don't consume resolveValue"
gap is fully closed.

---

## Track B — Privates beyond validators

Lower priority. Sequence after Track A.

| Cluster         | File                                                                                                      |   Misses |
| --------------- | --------------------------------------------------------------------------------------------------------- | -------: |
| Serialization   | `serializers/json.rb`                                                                                     |        5 |
| Serialization   | `serialization.rb`                                                                                        |        3 |
| Type primitives | `type/integer.rb`                                                                                         |        7 |
| Type primitives | `type/date.rb`                                                                                            |        5 |
| Type primitives | `type/date_time.rb`                                                                                       |        4 |
| Type primitives | `type/decimal.rb`                                                                                         |        3 |
| Type primitives | `type/helpers/numeric.rb`                                                                                 |        3 |
| Type primitives | `type/helpers/time_value.rb`                                                                              |        2 |
| Core            | `model.rb`                                                                                                |        8 |
| Core            | `validations.rb`                                                                                          |       11 |
| Core            | `lint.rb`                                                                                                 |        2 |
| Misc            | `naming.rb`, `validator.rb`, type/{boolean, big_integer, immutable_string, registry, string, time, value} | 1-2 each |

**PR B1 — `serializers/json.rb` privates**
Likely candidates from Rails source: `_filter_only_or_except`-style helpers feeding `as_json` / `from_json`. Worth a fresh Rails read; some may unblock test cases under `json_serialization_test.rb`.

**PR B2 — Type primitive privates (split per file)**
Sub-second + coercion internals. These tend to surface real Rails
divergences in numeric edge cases. One PR per file is over-scope; bundle
related primitives (e.g. `date.rb` + `date_time.rb` + `time_value.rb`
in one PR; `integer.rb` + `decimal.rb` + helpers/numeric in another).

**PR B3 — `model.rb` (8 misses) and `validations.rb` (11 misses)**
Largest single-file gaps. Likely needs scoping investigation before
committing to a single PR — could be 2-3 PRs each. Defer until Track A
and B1/B2 land so the scope is stable.

**Track B target:** activemodel privates 74.8% → ~95%.

---

## Track C — `test:compare` push to 100%

Currently 959/963 (99.6%). Only 4 missing tests, but they're worth
identifying explicitly before scoping. Some may unblock for free as
Track A privates land.

**PR C0 — Investigation, no code**
Run `pnpm test:compare --package activemodel` and identify the 4
missing test names. Map each to which Rails behavior it exercises and
whether Track A unblocks it. Output: an addendum to this doc with the
per-test breakdown.

**PR C1+ — Port the 4 tests**
Likely 1-2 PRs depending on whether the tests cluster by file. Each
test gets ported under the matching trails `*.test.ts` file with the
test name preserved per CLAUDE.md.

**Track C target:** test:compare 959/963 → 963/963 (100%).

---

## Track D — `Model#readAttribute` → `MissingAttributeError`

The 217-call-site refactor that the post-100% review flagged but kept
out of scope because it's much larger than a cleanup PR.

Rails `attribute_methods.rb:553` raises `MissingAttributeError` via
`missing_attribute(attr_name, stack)`. Trails `Model#readAttribute`
returns `null` for unknown attributes — divergence currently documented
inline in `model.ts:readAttribute`. 217 internal call sites across 47
files (excluding tests / `dist/` / `.d.ts`) currently rely on
null-return. Naive flip raises in many code paths — `secure-password`,
validators, callbacks, dirty tracking.

**PR D0 — Caller audit, no code**
Categorize the 217 sites:

- (a) "definitely defined, raise on miss" → keep `readAttribute`.
- (b) "may be undefined, treat as nil" → switch to
  `hasAttribute(name) ? readAttribute(name) : null` or a new
  `tryReadAttribute(name)` helper.

Decide whether to introduce `tryReadAttribute` or require explicit
`hasAttribute` guards. Rails ActiveRecord overrides `_read_attribute`
to return nil via `@attributes.fetch_value(attr)`; ActiveModel raises.
Pick a stance.

Output: addendum to this doc with per-file caller breakdown + the
helper-vs-guard decision.

**PR D1 — Introduce `tryReadAttribute` (or chosen alternative)**
Pure addition. No behavior change to existing `readAttribute`.

**PR D2…Dn — Migrate callers, file by file or feature cluster**
Probably 4-6 PRs grouped by area: secure-password, validators,
callbacks, dirty tracking, ActiveRecord-side callers, the rest.
Each PR replaces the relevant `readAttribute` calls with the chosen
alternative.

**PR Dfinal — Flip `readAttribute` to raise**
Once all internal callers are migrated, flip the default. Remove the
divergence comment in `model.ts:readAttribute`.

**Track D target:** Trails `readAttribute` matches Rails' raise
semantics; activemodel divergence comment removed.

---

## Won't fix

**`attribute_missing` eager-dispatch divergence.** TS has no
`method_missing`. Trails routes ALL generated per-attribute methods
through `attributeMissing` so subclass overrides work; Rails only
routes the cold `method_missing` path. Behaviorally equivalent for
override semantics; mechanism mismatch is unavoidable. Comment in
`attributes.ts:defineDirtyAttributeMethods` documents it.

---

## Suggested execution order

1. **Track A** (5-6 PRs) — highest leverage. Closes the validator
   `resolveValue` consumption gap. Lifts privates from 74.8% → ~83%.
   Likely side-lifts test:compare.
2. **Track C0 investigation** — identifies the 4 missing tests; some
   probably already unblocked by Track A.
3. **Track C1+** in parallel with B — small, low-risk.
4. **Track B** — broader privates push. Sequence after A so validator
   patterns are established.
5. **Track D last** — biggest commitment, biggest risk. Don't start
   until A and B have a comfortable cadence so the Model touch surface
   is stable.
