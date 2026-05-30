# Adapter hash-only constructor migration plan

**Status:** proposed (planning only — no code yet)
**Goal:** Align trails' concrete adapter constructors with Rails, which build an
adapter from a **configuration hash only**. Remove the trails-specific
URL/connection-string constructor convenience and route URL→hash resolution
through the existing config layer, the way Rails does.

## Why (the smell)

Rails' adapter `initialize` only ever receives a symbolized **config hash**
(`postgresql_adapter.rb:320`, `mysql2_adapter.rb`, `sqlite3_adapter.rb:102`).
URL / `DATABASE_URL` parsing happens **upstream** in
`ActiveRecord::DatabaseConfigurations` (`UrlConfig` / `ConnectionUrlResolver`)
before any adapter is constructed; the adapter never sees a URL string.

trails diverged: `PostgreSQLAdapter` / `Mysql2Adapter` constructors accept
`string | configHash`, and the `typeof config === "string"` branch does its own
URL parsing inside the adapter. That duplicate parsing is why review feedback
keeps surfacing "the message says config hash but a string can hit it too"
ambiguities (e.g. PR #2700's `ArgumentError` guard).

The string form is called from **~146 sites across ~80 files** — which is the
smell the migration addresses: call sites reach past the config layer and hand
the adapter a URL directly.

### Crucial finding — it's all test code

Every string-form call site is in `*.test.ts` or test infrastructure
(`test-helpers/setup-adapter-suite.ts`, `test-helpers/with-transactional-fixtures.ts`).
**No production runtime path** constructs an adapter from a URL string. So this
migration changes test ergonomics only — runtime behavior is unaffected, which
substantially lowers risk.

## Existing infra to reuse (don't reinvent)

- `database-configurations/connection-url-resolver.ts` — `new
ConnectionUrlResolver(url).toHash()` already produces a Rails-faithful
  `DatabaseConfigOptions` hash (compact_blank + URI-decode). This is the exact
  URL→hash converter the adapters should NOT be duplicating.
- `database-configurations/url-config.ts` — Rails' `UrlConfig` equivalent.
- `test-adapter.ts` — the canonical test factory **already** constructs PG/MySQL2
  from hashes (`new PostgreSQLAdapter({ ... })`, lines ~99/112). The Rails-aligned
  pattern already exists; most test files simply bypass it for the URL shorthand.

## Target state

1. `PostgreSQLAdapter` / `Mysql2Adapter` constructors accept **only** a config
   hash (plus the deprecated raw-connection overload from #2700). Delete the
   `typeof config === "string"` branches and their in-adapter URL parsing.
2. URL strings are converted to a hash by the caller via the config layer
   (`ConnectionUrlResolver(url).toHash()`), never inside the adapter.
3. Tests obtain adapters through a single helper that owns the URL→hash step,
   so the conversion lives in one place (see Phase 1).
4. (Stretch) `SQLite3Adapter` — see "SQLite sub-divergence" below.

## Migration phases (each a PR off `main`, ≤300 LOC, non-overlapping files)

### Phase 0 — Land #2700 first

#2700 edits the PG/MySQL2 constructors (raw-connection overload). This migration
also edits those constructors, so it MUST follow #2700 to avoid file-overlap
conflicts. Do not start Phase 1 until #2700 merges; rebase onto updated `main`.

### Phase 1 — Introduce the URL→hash test helper (additive, no removals)

- Add a helper (e.g. `adapterConfigFromUrl(url)` → hash via
  `ConnectionUrlResolver.toHash()`, or a thin `testAdapterForUrl(url)` factory)
  in `test-adapter.ts` / per-adapter `test-helper.ts`.
- No call-site changes yet; no constructor changes. Pure addition + unit test.
- ~40–60 LOC. Unblocks the mechanical migration.

### Phase 2..N — Migrate call sites in batches (mechanical)

- Convert `new XAdapter(PG_TEST_URL)` → `new XAdapter(adapterConfigFromUrl(PG_TEST_URL))`
  (or the helper), batch by directory to keep each PR ≤300 LOC and
  non-overlapping with sibling agents:
  - PG adapter tests (`adapters/postgresql/**`)
  - MySQL adapter tests (`adapters/abstract-mysql-adapter/**`, `adapters/mysql2/**`)
  - top-level `src/*.test.ts` (dirty, transactions, transaction-isolation, …)
  - test-infra (`test-helpers/**`, `test-setup-worker-db.ts`)
- ~80 files total; expect ~4–6 batch PRs. Each is find-and-replace + run the
  touched test files. The `{ uri: MYSQL_TEST_URL }` / `{ connectionString:
PG_TEST_URL }` hash forms (≈20 sites) already pass a hash — leave or normalize
  to the helper for consistency.

### Phase final — Remove the string branch from the constructors

- Once NO call site passes a string, delete the `typeof config === "string"`
  branches + in-adapter URL parsing from PG/MySQL2.
- Narrow the constructor type to `configHash` (+ raw-connection overload).
- Simplifies the #2700 `ArgumentError` guard wording (no string path to be
  "misleading" about).
- ~60–100 LOC net deletion + constructor type tightening. Must be last.

## SQLite sub-divergence (decide separately)

`SQLite3Adapter` takes `(filename: string, options)` — also unlike Rails, which
takes a hash with a `database:` key (`sqlite3_adapter.rb:106-129`). Aligning it
is a parallel effort (filename positional → `{ database }` hash) touching its own
large set of `new SQLite3Adapter(":memory:")` call sites. Recommend treating as a
**separate plan** after PG/MySQL2 land, to avoid an oversized blast radius. Flag
for explicit go/no-go.

## Risks / open questions

- **Blast radius vs. value.** Pure test-ergonomics change; the payoff is API
  fidelity + removing duplicate URL parsing, not a runtime fix. Worth confirming
  the cost is justified pre-release (it is the right time if ever).
- **Helper shape.** `adapterConfigFromUrl(url): hash` (caller still `new`s the
  adapter) vs. `testAdapterForUrl(url): adapter` (helper owns construction).
  Former is more explicit/Rails-like; latter is terser. Lean toward the former.
- **Driver-specific keys.** PG `connectionString` and MySQL `uri` are real driver
  options; `ConnectionUrlResolver.toHash()` emits Rails keys (host/database/…),
  not driver-native ones. Verify the resolver output drives both drivers
  correctly, or have the helper map to driver-native config. This is the one
  genuinely non-mechanical risk — validate in Phase 1.
- **test:compare / api:compare.** Deleting the string branch removes no public
  Rails-mapped method (the branch isn't a counted method); deltas should stay
  ≥0. Confirm per PR.

## Sequencing summary

```
#2700 (raw-conn overload)  →  Phase 1 (helper)  →  Phase 2..N (call sites)  →  Phase final (delete string branch)
                                                                                 (SQLite: separate plan, optional)
```
