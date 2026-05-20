# Fixtures port plan

Port the remaining Rails `activerecord/test/fixtures/*.yml` files to TS so that
ported AR tests can call `useFixtures([...])` instead of inlining
`defineSchema()` / row inserts in `beforeAll`. Currently 12 of 122 translated.

## Why

1. **Unblock `test:compare` for fixture-driven Rails tests.** The exclusions in
   `scripts/api-compare/unported-files.ts` for `fixtures.rb`, `fixture_set/`,
   `test_fixtures.rb`, and `encryption/encrypted_fixtures.rb` exist mainly
   because the data isn't there — the loader, ID hashing
   (`fixtureId`/`FixtureSet.identify`), and cross-row `ref()` resolution are
   already implemented in `define-fixtures.ts`.
2. **Kill the inline-DDL hazard.** Phase 6 keeps tripping on `defineSchema()`
   calls inside `it()` bodies under PG/MySQL (see
   `feedback_tm_phase6_inline_ddl`). A canonical schema + named fixtures
   matches Rails' "load once in `setup_fixtures`" model and removes the
   surface where this can happen.
3. **Mechanical parity.** `fixtureId()` already mirrors Rails' CRC32
   `FixtureSet.identify`, so once a fixture is translated its row IDs match
   Rails byte-for-byte. Ported tests that assert specific IDs (or count
   joined rows) become drop-in.

## Current state

- 12 translated under `packages/activerecord/src/test-helpers/fixtures/`:
  `accounts, author-addresses, authors, books, comments, companies,
developers, developers-projects, posts, projects, topics` (+ `fixtures.test.ts`).
- 110 missing. Categorized below by usage cluster.
- Loader is already in place: `defineFixtures()`, `useFixtures()`,
  `fixtureId()`, `ref()`, `fixture-set.ts`.

## Gap, by cluster

Rough grouping (ordered by likely test-file demand):

1. **Core associations long-tail** — `categories`, `categorizations`,
   `categories_posts`, `categories_ordered`, `taggings`, `tags`, `essays`,
   `readers`, `author_favorites`, `bad_posts`, `other_posts`, `other_comments`,
   `other_topics`, `other_books`, `subscribers`, `subscriptions`, `references`.
2. **Pirates / ships universe** (HABTM + STI test bed) — `pirates`, `ships`,
   `parrots`, `parrots_pirates`, `dead_parrots`, `live_parrots`, `treasures`,
   `peoples_treasures`, `doubloons`, `mateys`, `friendships`.
3. **People / clubs / memberships** — `people`, `members`, `member_details`,
   `member_types`, `memberships`, `clubs`, `sponsors`, `organizations`,
   `interests`, `jobs`, `tasks`.
4. **Pets / animals** — `dogs`, `other_dogs`, `dog_lovers`, `pets`, `toys`,
   `owners`, `humans`, `faces`.
5. **STI / inheritance test bed** — `vegetables`, `mixins`, `chefs`,
   `cake_designers`, `drink_designers`, `paragraphs`, `content`,
   `content_positions`, `collections`, `colleges`, `courses`, `entrants`,
   `customers`, `products`, `variants`, `clothing_items`, `items`.
6. **Composite PK (CPK) cluster** — `cpk_authors`, `cpk_books`, `cpk_orders`,
   `cpk_order_agreements`, `cpk_order_tags`, `cpk_reviews`, `cpk_tags`.
7. **Sharded cluster** — `sharded_blogs`, `sharded_blog_posts`,
   `sharded_blog_posts_tags`, `sharded_comments`, `sharded_tags`.
8. **UUID / type / edge** — `uuid_parents`, `uuid_children`, `binaries`,
   `aircrafts`, `bulbs`, `cars`, `computers`, `minivans`, `speedometers`,
   `dashboards`, `movies`, `traffic_lights`, `virtual_columns`,
   `mixed_case_monkeys`, `legacy_things`, `minimalistics`, `funny_jokes`,
   `randomly_named_a9`, `1_need_quoting`, `string_key_objects`,
   `warehouse-things`, `nodes`, `trees`, `edges`, `vertices`, `citations`,
   `ratings`, `price_estimates`, `tasks`.
9. **Encryption** — `encrypted_books`, `encrypted_book_that_ignores_cases`.
10. **Misc** — `strict_zines`, `zines`, `fk_object_to_point_to`,
    `fk_test_has_fk`, `fk_test_has_pk`.

(Some files appear in multiple clusters; first-hit wins for batching.)

## Translation rules

Each `*.yml` becomes one TS file under `fixtures/`, exporting
`<name>FixtureData` as `{ rowName: { col: value, ... } }`. Conventions
already established in the 12 done files:

- File name: kebab-case (`developers-projects.ts` for
  `developers_projects.yml`).
- Skip Rails' explicit `id: N` columns. CRC32 over the row name produces a
  stable id; Rails tests that look up by `name`/`title` use the row name
  too. Tests that hard-code numeric ids will need to be reviewed at port
  time (see "Open questions").
- Foreign keys → `ref("other_table", "row_name")`. Rails' string-form
  references (`owner_id: foo`) resolve via `FixtureSet.identify("foo")`, so
  `ref()` produces the same number.
- Rails fixture row label case is preserved as-is (e.g. Rails' `david` →
  TS `david`). For cross-fixture refs the row label string must match
  byte-for-byte.
- Inline comments map to TS comments only if non-obvious; keep the header
  `// activerecord/test/fixtures/<name>.yml` line.
- ERB-rendered fixtures (a handful: `binaries.yml`, `developers.yml`
  conditional adapter blocks) become small inline TS conditionals.

## Verification — `pnpm fixtures:compare`

A new script under `scripts/fixtures-compare/` that diffs each Rails YAML
against its TS counterpart and reports drift, modeled on the api/test
compare scripts.

### Behavior

For every `vendor/rails/activerecord/test/fixtures/<name>.yml`:

1. **Locate TS counterpart**: kebab-case name under
   `packages/activerecord/src/test-helpers/fixtures/<kebab-name>.ts`. If
   missing, report `MISSING` (counts toward gap).
2. **Parse YAML** with a minimal AR-fixture-aware reader (no Psych: just
   `yaml` lib + a tiny ERB stripper that emits a comment for non-trivial
   ERB blocks, since none of the AR fixtures use ERB control flow that we
   care to evaluate — they use `<%= ... %>` for adapter-conditional values
   only).
3. **Load TS** via dynamic `import()` of the source file (or a vite-node
   eval) to get `<name>FixtureData`.
4. **Per-row diff**:
   - Row keys must match exactly.
   - For each row, attribute keys must match. Mismatch buckets:
     `extra-in-ts`, `missing-in-ts`, `value-differs`.
   - Value equality:
     - Scalars: deep-equal.
     - Rails `id: N` MUST appear on the TS side with the same value
       (per decision 1). Mismatch / absence → `id-divergence`.
     - Rails string-form FK (`parent_id: foo`) equals TS `ref("table",
"foo")` when the resolved fixture id (declared `id` on the target
       row) matches.
     - Rails numeric FK (`parent_id: 1`) equals TS `ref("table", "foo")`
       when the target row's declared id equals `1`. No CRC32 fallback.
5. **Output**: per-file summary like api:compare:

   ```
   authors.yml                authors.ts         rows: 3/3   attrs: 9/9   100% ✓
   author_favorites.yml       (missing)                       —          MISSING
   chefs.yml                  chefs.ts           rows: 5/5   attrs: 7/8   88%  (extra-in-ts: 1)
   ```

6. **Exit code**: soft (warnings only) until PR 10 flips strictness
   (per decision 4). `MISSING`, `value-differs`, and `id-divergence` all
   surface in output but don't fail CI during the port.

### Scope of the script

- Reads files only; no DB.
- Lives under `scripts/fixtures-compare/`. Wire as `pnpm fixtures:compare`
  in the root `package.json`, mirroring `api:compare`.
- Has a `--package activerecord` flag for future generalization but only
  AR is in scope now.

## Rollout

PR-sized batches targeting ~250 LOC each. Small clusters bundle
together; the two over-ceiling clusters (C1, C8) split into `a`/`b`
sibling PRs from `main`. Order:

1. **PR 0** — `scripts/fixtures-compare/` script + CI wiring (soft
   failure). Lands first so subsequent PRs are self-checking.
2. **PR 0.5** — Port `test/schema/schema.rb` → `test-schema.ts`. Sized to
   ceiling; split as `0.5a` / `0.5b` if needed (non-overlapping table
   groups, each off `main`). Wire into `setup-adapter-suite.ts` as the
   canonical schema for every ported test.
3. **PR 0.75** — Backfill explicit Rails ids onto the 12 already-translated
   fixtures (`accounts`, `author-addresses`, `authors`, `books`, `comments`,
   `companies`, `developers`, `developers-projects`, `posts`, `projects`,
   `topics`). Land the `ref()` resolver change to read declared `id`s
   here so the rest of the port runs against the final API.
   Cluster sizes (Rails YAML LOC; TS ≈ 1.5×) drive bundling. C1 and C8
   exceed the 300-LOC ceiling on their own; C2/C4/C6/C7/C9/C10 are too
   small to stand alone (per [[feedback_no_tiny_prs]],
   [[feedback_bundle_to_pr_ceiling]]). Re-bundled:

4. **PR 1a** — Cluster 1 first half: `categories`, `categorizations`,
   `categories_posts`, `categories_ordered`, `taggings`, `tags`,
   `essays`, `readers`. (~250 LOC) Highest test demand under
   `relation/`/`associations/`.
5. **PR 1b** — Cluster 1 second half: `author_favorites`, `bad_posts`,
   `other_posts`, `other_comments`, `other_topics`, `other_books`,
   `subscribers`, `subscriptions`, `references`. (~250 LOC)
6. **PR 2** — Cluster 2 (pirates/ships) + Cluster 9 (encryption) +
   Cluster 10 (misc fk\_\*). Three small clusters bundled. (~190 LOC)
7. **PR 3** — Cluster 3 (people/clubs) + Cluster 4 (pets) split:
   take C3 fully and the C4 tail (`pets`, `toys`, `owners`, `humans`,
   `faces`) — leave `dogs`/`other_dogs`/`dog_lovers` for PR 5 if needed
   to stay under ceiling. Target ~280 LOC.
8. **PR 4** — Cluster 5 (STI). (~260 LOC standalone)
9. **PR 5** — Cluster 6 (CPK) + Cluster 7 (sharded) + any C4 spillover.
   (~300 LOC)
10. **PR 6a** — Cluster 8 first half: `uuid_parents`, `uuid_children`,
    `binaries`, `aircrafts`, `bulbs`, `cars`, `computers`, `minivans`,
    `speedometers`, `dashboards`, `movies`, `traffic_lights`,
    `virtual_columns`. (~250 LOC)
11. **PR 6b** — Cluster 8 second half: `mixed_case_monkeys`,
    `legacy_things`, `minimalistics`, `funny_jokes`, `randomly_named_a9`,
    `1_need_quoting`, `string_key_objects`, `warehouse-things`, `nodes`,
    `trees`, `edges`, `vertices`, `citations`, `ratings`,
    `price_estimates`. (~250 LOC)
12. **PR 7** — Flip `fixtures:compare` to hard-fail; remove
    `fixtures.rb` / `fixture_set/` / `test_fixtures.rb` /
    `encryption/encrypted_fixtures.rb` from
    `scripts/api-compare/unported-files.ts`; port the corresponding
    Rails test files.
13. **PR 8 — proof-of-concept conversion.** Pick one existing AR test
    file that currently inlines `defineSchema()` and whose data needs
    are met by the translated fixtures (good candidates: `relations.test.ts`,
    `serialization.test.ts`, `finder-respond-to.test.ts`, or one of the
    association-cluster tests under `associations/`). Rewrite it to:
    - drop the inline `defineSchema()` call (canonical schema from PR 0.5
      is loaded by `setup-adapter-suite`),
    - call `useFixtures([...])` at the top with the named fixtures it
      needs,
    - replace ad-hoc `Model.create({...})` setup with `fixtureRow(...)`
      lookups by row label.

    This PR is the proof that the capability works end-to-end, captures
    the migration pattern, and gives the follow-up bulk-migration plan a
    worked example to reference. Out of scope: migrating any other test
    files — that's a separate plan.

## Decisions

1. **Always mirror Rails ids.** Every TS fixture row carries the explicit
   `id: N` from the Rails YAML. CRC32-default via `fixtureId()` is dropped
   for ported fixtures — Rails parity wins, since literal-id assertions
   in ported tests must work without modification. The `fixtureId()` helper
   stays in place for ad-hoc test-only fixtures that aren't mirroring a
   Rails YAML.

   Consequence for `ref()`: the resolver must read the target fixture's
   declared `id` (not compute CRC32) when the target row carries one. The
   compare script enforces id parity by comparing TS `id` ↔ Rails `id`
   directly.

2. **Schema port lands as PR 0.5 (before fixture clusters).** Port
   `vendor/rails/activerecord/test/schema/schema.rb` into a canonical
   `packages/activerecord/src/test-helpers/test-schema.ts` that
   `setup-adapter-suite.ts` can call once per suite. Every fixture PR
   after that assumes the schema is loaded; no per-cluster mini-schemas.

   PR 0.5 is sized like any other PR (300 LOC ceiling) — if the schema is
   too large for one PR, split by table cluster (`0.5a`, `0.5b`, …) with
   non-overlapping table groups, each branched from `main`.

3. **ERB → `adapterName` helper.** Add `adapterName(adapter)` to
   `define-fixtures.ts` so TS fixtures can write
   `{ data: adapterName(adapter) === "postgres" ? a : b }`. The compare
   script renders Rails ERB with stub bindings (`ActiveRecord::Base
.connection.adapter_name → "PostgreSQL" | "Mysql2" | "SQLite"`) and
   diffs per-adapter. Land the helper alongside the first ERB-using
   fixture.

4. **CI strictness: soft until PR 10, then hard-fail.** `MISSING` is a
   warning through the entire port; `value-differs` and `id-divergence`
   are warnings too (we surface them in compare output but don't fail CI)
   until PR 10 flips the script to hard-fail and removes the
   `fixtures.rb` / `fixture_set/` / `test_fixtures.rb` /
   `encryption/encrypted_fixtures.rb` exclusions from
   `scripts/api-compare/unported-files.ts`.
