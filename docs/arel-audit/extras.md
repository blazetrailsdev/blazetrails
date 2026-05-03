# Extras — files in our tree that don't have a 1:1 Rails counterpart

## Top-level

- **`predications-range.ts`** — extracted helper for the range-handling decision tree inside `between` / `notBetween`. Necessary because TS lacks a Ruby `Range` type, so `parseRange` normalizes `[begin, end]` / `{begin,end,excludeEnd?}` / `(begin, end, excludeEnd?)` into a single shape before the decision tree runs. Mirrors Rails' inline logic in `predications.rb`.
- **`quote-array.ts`** — adapter helper for quoting array values; used by `Predications#quotedArray`. Rails inlines the equivalent `Array#map { build_quoted }`.
- **`index.ts`** — package barrel; not in Rails (Rails uses `nodes.rb` / `visitors.rb` aggregator files).

## nodes/

Rails `nary.rb` bundles `Nary` + `And` + `Or` in one file via `Class.new(Nary)`. TS splits them:

- **`and.ts`** → Rails `Nary And` in `nary.rb`
- **`or.ts`** → Rails `Nary Or` in `nary.rb`

Rails `unary.rb` bundles many subclasses via `const_set`. TS splits some:

- **`bin.ts`** → Rails `Bin` in `unary.rb`
- **`distinct.ts`** → Rails `Distinct` (Note: Rails has `Distinct` in `terminal.rb`, not `unary.rb` — verify TS placement)
- **`not.ts`** → Rails `Not` in `unary.rb`

Rails `binary.rb` bundles via `const_set`. TS splits:

- **`as.ts`** — Rails `As` is a named class in `binary.rb` with a `to_cte` method. TS splits to its own file but As is also re-exported from binary.ts. Verify there's no duplicate definition.

Rails `function.rb` bundles via `const_set`. TS splits:

- **`sum.ts`** → Rails `Sum` in `function.rb`. (`Max`/`Min`/`Avg`/`Exists` stay in `function.ts`.)

`equality.ts`, `in.ts`, `matches.ts`, `regexp.ts`, `count.ts`, `cte.ts`, `extract.ts`, `case.ts` — these all match Rails 1:1 (each has its own `.rb` file).

### api:compare implications

`api:compare` walks Rails files and looks for matching TS files. The split-out files (`and`/`or`/`bin`/`distinct`/`not`/`sum`/`as`) need entries in the rename/skip table to map back to `nary.rb`/`unary.rb`/`binary.rb`/`function.rb`. Already done? Check `scripts/api-compare/compare.ts`.

## visitors/

- **`default-quoter.ts`** — Trails-only quoter abstraction (62 LOC). See `visitors.md` for rationale.
- **`dispatch-contamination.test.ts`** — regression test for per-class dispatch cache isolation. TS-only mechanism.
- **`index.ts`** — barrel.

## Test fixtures (TS-only, not in Rails)

These pin behavior that Rails covers via implicit Ruby semantics:

- `attribute-alignment.test.ts` (115 LOC)
- `expression-mixins.test.ts` (124 LOC)
- `predications-privates.test.ts` (174 LOC)
- `predications-range.test.ts` (173 LOC)
- `quote-array.test.ts` (51 LOC)
- `factory-methods.test.ts` (111 LOC)
- `attributes.test.ts` (26 LOC)
- `nodes.test.ts` (22 LOC)

These are healthy and align with the "implementation-first" working principle.
