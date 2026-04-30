# activemodel post-100% follow-up plan

`pnpm api:compare --package activemodel` is at **448/452 (99.1%)** with
privates included. Public surface is done. This doc tracks the remaining
follow-up tracks: privates beyond validators, the small `test:compare`
gap, and the `readAttribute` Rails-parity refactor.

Read the Rails source before each PR. Don't paraphrase from memory.
Per CLAUDE.md: ≤ 300 LOC per PR, draft, branch from `main`, no
subagents, no `Co-Authored-By` lines.

Rails reference: `scripts/api-compare/.rails-source/activemodel/`.

## Current state

```
pnpm api:compare --package activemodel              → 448/452 (99.1%)
```

Remaining 4 misses are spread across `api.rb`, `model.rb`, `type/value.rb`,
and `validations.rb` (1 each).

---

## Track B — Privates beyond validators

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
committing to a single PR — could be 2-3 PRs each. Defer until B1/B2
land so the scope is stable.

---

## Track C — `test:compare` push to 100%

**PR C0 — Investigation, no code**
Run `pnpm test:compare --package activemodel` and identify any missing
test names. Map each to which Rails behavior it exercises. Output: an
addendum to this doc with the per-test breakdown.

**PR C1+ — Port the missing tests**
Likely 1-2 PRs depending on whether the tests cluster by file. Each
test gets ported under the matching trails `*.test.ts` file with the
test name preserved per CLAUDE.md.

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

1. **Track C0 investigation** — identifies any missing tests.
2. **Track C1+** in parallel with B — small, low-risk.
3. **Track B** — broader privates push.
4. **Track D last** — biggest commitment, biggest risk. Don't start
   until B has a comfortable cadence so the Model touch surface
   is stable.
