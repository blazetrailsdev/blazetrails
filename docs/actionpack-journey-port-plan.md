# actionpack journey port: sizing audit + PR slicing plan

This is **Wave 7** of the actionpack restructure
([actionpack-restructure-audit.md](actionpack-restructure-audit.md)),
which explicitly deferred sizing of the `action_dispatch/journey/` port
to a separate pass. This doc is that pass. **No code lands here** — this
is a Phase 1 sizing audit; the parent session will spawn port slots
from the slicing below once it lands.

## Headline numbers

| Metric                                                                           | Value                                 |
| -------------------------------------------------------------------------------- | ------------------------------------- |
| Rails `.rb` files under `action_dispatch/journey/`                               | **14**                                |
| Total Ruby LOC                                                                   | **2062**                              |
| Estimated TS LOC after porting (≈ Ruby × 1.3)                                    | **~2680**                             |
| Existing TS counterparts under `packages/actionpack/src/actiondispatch/journey/` | **0** (subtree absent)                |
| Rails journey test LOC (`test/journey/`)                                         | **1603** across 11 files              |
| Expected PR count (LOC ceiling waived for ports; sized by cluster)               | **9 port PRs + 1 wire-up = 10 total** |

Per-file LOC (Ruby, `wc -l`):

| File                      | LOC      |
| ------------------------- | -------- |
| `nfa/dot.rb`              | 27       |
| `gtg/simulator.rb`        | 50       |
| `scanner.rb`              | 74       |
| `routes.rb`               | 82       |
| `parser.rb`               | 103      |
| `router/utils.rb`         | 105      |
| `gtg/builder.rb`          | 149      |
| `router.rb`               | 151      |
| `route.rb`                | 189      |
| `nodes/node.rb`           | 208      |
| `path/pattern.rb`         | 209      |
| `gtg/transition_table.rb` | 217      |
| `formatter.rb`            | 231      |
| `visitors.rb`             | 267      |
| **Total**                 | **2062** |

Existing surface check:

```
$ find packages/actionpack/src -name '*journey*'
# (no matches)
```

This matches the actionpack restructure audit's "0% file coverage" for
`journey/`. Confirmed: green-field port.

## Import graph

Outgoing-deps per file (from `require`/`require_relative` plus
class-level `Journey::*` references):

| File                      | Internal deps                                                                              | External deps                        |
| ------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| `router/utils.rb`         | —                                                                                          | (stdlib)                             |
| `scanner.rb`              | —                                                                                          | `strscan`                            |
| `nfa/dot.rb`              | —                                                                                          | —                                    |
| `gtg/simulator.rb`        | (uses `TransitionTable` via duck-typing in arg; no require)                                | `strscan`                            |
| `gtg/transition_table.rb` | `nfa/dot` (mixin `include Journey::NFA::Dot`)                                              | —                                    |
| `gtg/builder.rb`          | `gtg/transition_table`; consumes parser AST + node types                                   | —                                    |
| `nodes/node.rb`           | `visitors` (for `accept` dispatch — but only references `Visitor` at call sites)           | —                                    |
| `parser.rb`               | `scanner`, `nodes/node`; `include Journey::Nodes`                                          | —                                    |
| `visitors.rb`             | refs `Router::Utils` (escape lambdas), defines `Journey::Format`                           | —                                    |
| `path/pattern.rb`         | `visitors` (subclass `Journey::Visitors::Visitor`), `parser` (AST input), `nodes/node`     | —                                    |
| `route.rb`                | `path/pattern` (holds a Pattern); `gtg/transition_table` via `Routes#simulator` at runtime | —                                    |
| `routes.rb`               | `route`, `gtg/{builder, simulator, transition_table}` (builds & memoizes the simulator)    | —                                    |
| `formatter.rb`            | `routes` (consumes), `visitors` (`FormatBuilder`), `route` (RouteWithParams)               | `action_controller/metal/exceptions` |
| `router.rb`               | `router/utils`, `routes`, `formatter`, `parser`, `route`, `path/pattern`                   | —                                    |

### Coupling clusters (derived from the graph)

1. **L — Leaf utilities (no internal deps).** `router/utils.rb`,
   `nfa/dot.rb`, `gtg/simulator.rb`. Pure functions / small classes
   that downstream code consumes. Can ship first.
2. **S — Scanner+parser+nodes.** `scanner.rb`, `nodes/node.rb`,
   `parser.rb`. Parser depends on both, node `accept` dispatch
   logically depends on visitors but is just a `visitor.visit_X(self)`
   call so it can ship before `visitors.rb` lands (with a `Visitor`
   interface stub typed in `node.ts`).
3. **V — Visitors + Format.** `visitors.rb`. Depends on `nodes/node`
   (visits AST), `router/utils` (escape lambdas). Defines
   `Journey::Format` consumed by `path/pattern` and `route`.
4. **P — Path/pattern.** `path/pattern.rb`. Depends on S + V (subclasses
   `Visitors::Visitor` as `AnchoredRegexp`/`UnanchoredRegexp`).
5. **G — GTG automaton.** `gtg/transition_table.rb`, `gtg/builder.rb`.
   Transition table mixes in `nfa/dot`. Builder consumes the parser AST
   (so depends on S) and builds a TransitionTable from it.
6. **R — Routing API.** `route.rb`, `routes.rb`, `formatter.rb`,
   `router.rb`. Bottom-up: `route` (holds a Pattern), `routes` (holds
   routes + memoized simulator from G), `formatter` (uses routes +
   visitors), `router` (top-level: orchestrates all of the above).

Strict topological dependency order: **L → S → V → P → G → R**. Note
G doesn't depend on V or P (only on S + L); P doesn't depend on G. So
**G and P can ship in parallel** once L+S+V have landed.

## PR slicing

**LOC ceiling waived for this wave** (decision 2026-05-14, recorded in
[[feedback-loc-limit-code-moves]]): for mechanical Rails ports the
300-LOC CLAUDE.md ceiling does not apply — size by logical cluster
instead. Splitting `nodes.rb` + `parser.rb` just to satisfy the ceiling
would produce churn without review-cost savings. Below: **9 PRs total
(8 cluster + 1 wire-up)**, at ~250–550 LOC each.

### PR 1 — Journey leaf utilities (L cluster)

- **Files in scope:** `router/utils.rb` (105) + `nfa/dot.rb` (27) +
  `gtg/simulator.rb` (50). Plus `packages/actionpack/src/actiondispatch/journey/index.ts` barrel.
- **Estimated TS LOC:** ~240 src + ~80 tests = **~320 total** (tight; if
  tests overshoot, defer `simulator.test.ts` to PR-6).
- **Dependencies:** none. First PR in the wave.
- **Tests:** port `test/journey/router/utils_test.rb` (48 LOC) and a
  smoke test for `Simulator#simulate`. `nfa/dot` is a visualization
  helper — port the method but skip its test (Rails doesn't have one).
- **Wire-up:** none.

### PR 2 — Scanner (S₁)

- **Files:** `scanner.rb` (74).
- **Estimated TS LOC:** ~100 src + ~100 tests = **~200 total**.
- **Dependencies:** PR 1 (index barrel).
- **Tests:** port `test/journey/route/definition/scanner_test.rb` (89).
- **Wire-up:** none. **Risk:** Ruby `StringScanner` API has no JS
  equivalent — port as a small TS class (mirrors what `arel` did for
  similar token-stream needs). See Risks §.

### PR 3 — Nodes + Parser (S₂)

- **Files:** `nodes/node.rb` (208) + `parser.rb` (103).
- **Estimated TS LOC:** ~400 src + ~260 tests = **~660 total**.
- **Dependencies:** PR 2.
- **Tests:** `route/definition/parser_test.rb` (112) +
  `nodes/ast_test.rb` (91), both inline with the source PR.
- **Wire-up:** none. **Note:** Rails' `parser.rb` is generated from a
  Racc grammar (the `racc` gem). Port as a **hand-written recursive
  descent parser** — the grammar is tiny (path segments, optionals,
  groups, slashes, dots, stars). Do **not** try to port the Racc output
  table verbatim.

### PR 4 — Visitors + Format (V)

- **Files:** `visitors.rb` (267).
- **Estimated TS LOC:** ~350 src.
- **Dependencies:** PR 3 (Nodes), PR 1 (Router::Utils escape).
- **Tests:** no direct visitor tests in Rails — covered transitively
  by pattern_test (PR 5).
- **Wire-up:** none.

### PR 5 — Path/Pattern (P)

- **Files:** `path/pattern.rb` (209).
- **Estimated TS LOC:** ~270 src + ~280 tests = **~550 total**.
- **Dependencies:** PR 3 (Nodes), PR 4 (Visitor base).
- **Tests:** `test/journey/path/pattern_test.rb` (313).
- **Wire-up:** none. **Risk:** regex semantics (see Risks §).

### PR 6 — GTG automaton (G)

- **Files:** `gtg/transition_table.rb` (217) + `gtg/builder.rb` (149).
- **Estimated TS LOC:** ~480 src + ~220 tests = **~700 total**.
- **Dependencies:** PR 3 (Nodes — Builder walks the AST), PR 1
  (Simulator/Dot already landed).
- **Tests:** `gtg/transition_table_test.rb` (125) + `gtg/builder_test.rb` (98).
- **Can ship in parallel with PR 4 + PR 5** once PR 3 is in.

### PR 7 — Route + Routes (R₁)

- **Files:** `route.rb` (189) + `routes.rb` (82).
- **Estimated TS LOC:** ~350 src + ~190 tests = **~540 total**.
- **Dependencies:** PR 5 (Pattern), PR 6 (Simulator memoization).
- **Tests:** `route_test.rb` (115) + `routes_test.rb` (74).
- **Wire-up:** none yet.

### PR 8 — Formatter (R₂)

- **Files:** `formatter.rb` (231).
- **Estimated TS LOC:** ~300 src + ~150 tests = **~450 total**.
- **Dependencies:** PR 4 (FormatBuilder + Format), PR 7 (Routes).
- **Wire-up:** none yet.

### PR 9 — Router (R₃) — top of stack

- **Files:** `router.rb` (151).
- **Estimated TS LOC:** ~200 src + ~500 tests = **~700 total**.
- **Dependencies:** PR 7, PR 8.
- **Tests:** `router_test.rb` (538) — largest single test file in the wave.

### PR 10 — Wire-up: `actiondispatch/routing/route-set.ts` switches to journey Router

- **Files in scope:** `packages/actionpack/src/actiondispatch/routing/route-set.ts`
  - any internal pattern compiler that the journey port replaces.
- **Estimated LOC:** ~200, depending on whether the current `route-set.ts`
  already exposes a router seam. **Open question** (see end of doc):
  audit `route-set.ts` before opening PR 10 to confirm seam presence;
  if absent, prepend a small seam-creation PR.
- **Dependencies:** PR 9 (full journey stack landed).
- **Tests:** existing routing integration tests must continue to pass.
  Add a focused test that exercises the journey router end-to-end via
  `route-set.ts`.
- **This is the only PR in the wave that touches code outside
  `actiondispatch/journey/`.** Sequence it last.

### Summary table

| PR  | Cluster | Src LOC | Test LOC | Total | Deps | Wire-up? |
| --- | ------- | ------- | -------- | ----- | ---- | -------- |
| 1   | L       | ~240    | ~80      | ~320  | —    | no       |
| 2   | S₁      | ~100    | ~100     | ~200  | 1    | no       |
| 3   | S₂      | ~400    | ~260     | ~660  | 2    | no       |
| 4   | V       | ~350    | —        | ~350  | 3, 1 | no       |
| 5   | P       | ~270    | ~280     | ~550  | 3, 4 | no       |
| 6   | G       | ~480    | ~220     | ~700  | 3    | no       |
| 7   | R₁      | ~350    | ~190     | ~540  | 5, 6 | no       |
| 8   | R₂      | ~300    | ~150     | ~450  | 4, 7 | no       |
| 9   | R₃      | ~200    | ~500     | ~700  | 7, 8 | no       |
| 10  | wire-up | ~200    | included | ~200  | 9    | **yes**  |

**Total: 10 PRs, ~4670 TS LOC.** Matches the parent audit's "6–8 PRs"
rough estimate. PRs 4 + 5 + 6 can ship in parallel once PR 3 lands.

## api:compare / test:compare impact

`scripts/api-compare/conventions.ts:rubyFileToTs` already converts
`action_dispatch/journey/router/utils.rb` →
`actiondispatch/journey/router/utils.ts` by the default snake→kebab
and `.rb`→`.ts` rules. Spot-check confirms no file in the journey
subtree needs a `FILE_OVERRIDES` entry: there are no
`railtie`/`trailtie`-style renames, no double-letter Ruby constants
that demand kebab-case workarounds (`gtg`, `nfa` are already
lowercase), and no Rails-conventional plural/singular shifts.

`scripts/api-compare/config.ts` already has `actionpack` in `PACKAGES`
and points `actionpack` at `packages/actionpack/src/`, so the new
`actiondispatch/journey/` subtree is picked up automatically — **no
config edits required**, in contrast to Wave 3 (AbstractController)
which created a new top-level logical package. This wave behaves like
Wave 2 (`http/`, `middleware/` moves): zero tooling churn.

Test-compare: `scripts/test-compare/extract-ts-tests.ts` uses
`**/*.test.ts` globs, so `*.test.ts` siblings of the new sources are
auto-detected. Rails' `test/journey/` directory is already inside
`actionpack/test/`, which `extract-ruby-tests.rb` already scans for the
`actionpack` key. No edits needed.

## Risks + open questions

- **Regex semantics — Ruby Regexp vs JS RegExp.** journey's
  `path/pattern.rb` builds anchored/unanchored regexes from the AST and
  relies on Ruby-specific features: **(a) named captures** (Ruby:
  `(?<name>...)`, JS: same since ES2018 — OK in modern Node);
  **(b) backreferences to named groups** (Ruby `\k<name>`, JS
  `\k<name>` — OK); **(c) Ruby `\A`/`\z` anchors** (JS uses `^`/`$`
  with `m` flag implications — must translate carefully); **(d) Ruby's
  default multiline-dot is OFF**, same as JS — OK. **Open question:**
  does journey rely on Ruby's `Regexp#match` returning a `MatchData`
  with full named-group + offset support? JS `RegExp.exec` returns
  `.groups` (named) and `.indices` (with `/d` flag, Node 16+). Plan to
  use `/d` flag everywhere journey compiles a regex and assert the
  Node floor in `package.json#engines`.
- **String performance — UTF-16 indexing.** journey's hot path is
  `Simulator#simulate(string)` which char-by-char advances a
  StringScanner. Ruby strings are byte-arrays; JS strings are
  code-unit arrays (UTF-16). For ASCII-only paths (the overwhelming
  common case) this is a wash. For paths containing non-BMP characters
  (rare; e.g. emoji in URLs) the indexing differs. Risk: low —
  document the divergence and don't chase.
- **Performance — routing is per-request.** Worth porting one or two
  of Rails' journey benchmarks (look under
  `actionpack/test/dispatch/routing/` for `bench_*` fixtures) so PR-10
  can demonstrate no regression. **Defer** the benchmark fixtures to
  PR-10 unless an earlier PR uncovers a clear hotspot.
- **Memoization patterns — Ruby `||=`.** journey uses `@x ||= compute`
  pervasively (every accessor in `path/pattern.rb`, `routes.rb`,
  `route.rb`). Standardize on a single pattern: **private nullable
  field + getter that lazy-initializes**, e.g.
  `get x(): T { return this._x ??= this.compute(); }`. Avoid
  per-instance memoization helpers; the field-+-getter pattern is
  what the rest of the codebase uses (see `relation.ts`).
- **Racc-generated parser.** As noted in PR 3, port the parser as a
  hand-written recursive-descent parser. The Racc output is
  table-driven and ugly; hand-porting is shorter and easier to read.
  **Open question:** is there any edge case in the Racc grammar that's
  not exercised by `route/definition/parser_test.rb`? Audit the
  generated parser's accept states against the test corpus during PR 3.
- **`nfa/dot.rb` — graphviz visualization helper.** This is a tiny
  (27-line) `to_dot` debug utility, not core. **Open question:** keep
  it in PR 1 (for path-parity with `api:compare`) or defer? The
  audit's recommendation is **port it in PR 1** — it's free coverage
  and ports trivially.
- **`gtg/simulator.rb` uses `strscan`.** Same StringScanner concern as
  the lexer (PR 2). Port `simulator` after the scanner-class TS
  abstraction lands in PR 2.

## Out of scope

- **test-compare BLOCKED coverage.** Per
  [test-compare-100-plan.md](test-compare-100-plan.md), test-mirror
  parity work is tracked separately. This plan ports tests
  inline alongside source, but does not commit to BLOCKED-vocabulary
  alignment for journey tests.
- **`actiondispatch/routing/mapper.rb` integration** (constraints,
  scopes, format DSLs). The mapper is the layer above journey; it
  feeds journey via `route-set.ts`. Mapper-side gaps are tracked
  under [actiondispatch-100-percent.md](actiondispatch-100-percent.md)
  and are not part of this wave. PR 10 (wire-up) does NOT include
  mapper changes — only the route-set seam swap.
- **`system_testing/`** — declared a known divergence in
  [actionpack-restructure-audit.md](actionpack-restructure-audit.md);
  unrelated to journey.
- **Custom router shortcuts.** Some Rails projects monkey-patch
  `ActionDispatch::Journey::Router`. Trails will not expose a
  monkey-patch surface; downstream extension points are deliberately
  scoped to the public routing DSL.
- **Benchmarks against Rails routing.** Useful but separate. If
  needed, open a follow-up plan; do not block Wave 7 on benchmark
  parity.

## Cross-references

- **[actionpack-restructure-audit.md](actionpack-restructure-audit.md)
  Wave 7** — parent audit that deferred this sizing pass.
- **[index.md](index.md)** — add this plan under the actionpack
  cluster (index entry below; lands with PR 1 of the wave).
- **Prerequisite waves:** none. Wave 7 does **not** depend on Waves
  1–6 of the restructure: it creates a fresh `actiondispatch/journey/`
  subtree with no incoming references until PR 10 wires `route-set.ts`.
  Waves 1–6 can proceed in parallel with Wave 7.
- **[actiondispatch-100-percent.md](actiondispatch-100-percent.md)** —
  method-level parity. Wave 7 will move the file-coverage bar for
  actiondispatch from ~55% to ~70% (14 new files), but method-level
  parity for journey internals will be tracked there in a follow-up.
- **`packages/arel/src/visitor.ts`** — precedent for the Visitor
  base class pattern PR 4 will follow.
- **`packages/activerecord/src/relation/`** — precedent for the
  lazy-getter memoization pattern.

## Tracking

Status: **sizing plan draft 2026-05-14.** Update LOC estimates with
actuals as each PR merges. The parent session will spawn slots from
the PR sketches above.
