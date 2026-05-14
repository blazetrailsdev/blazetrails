# Ruby source fetcher — unification plan

## Headline

- **3 fetch scripts** today (`fetch-rails.sh`, `fetch-rails-tests.sh`, `fetch-globalid.sh`) totalling **125 LOC**, of which ~50 LOC is near-identical clone/idempotency plumbing.
- **4 distinct on-disk source layouts** already present, with no unifying schema:
  - `scripts/api-compare/.rails-source/` — full git clone of `rails/rails` @ `v8.0.2`
  - `scripts/api-compare/.rack-source/` — full git clone of `rack/rack` @ `v3.1.14` (created by `fetch-rails-tests.sh`, not `fetch-rails.sh` — surprising)
  - `scripts/globalid-source/vendor/bundle/ruby/*/gems/globalid-*/` — bundler-vendored gem
  - `scripts/parity/schema/ruby/` — independent `Gemfile` re-pinning `activerecord 8.0.2` (cross-script version drift risk)
- **3 places hardcode source paths**: `scripts/api-compare/extract-ruby-api.rb:14`, `scripts/test-compare/extract-ruby-tests.rb:18-19`, `scripts/start-worktree.sh:154-155`.
- **Globalid is fetched but not wired**: `PACKAGES` in `scripts/api-compare/config.ts:7` lists no `globalid`; nothing in `scripts/test-compare/` references it. The fetcher exists in isolation.
- **Rack is wired into test-compare but bundled inside the rails-tests fetcher** — another precedent for a per-script ad-hoc origin, hidden from the api-compare path.

The fix is one source list, one fetcher, one layout. This doc designs it; implementation lands in 7 waves.

## 1. Current state inventory

### 1.1 `scripts/api-compare/fetch-rails.sh` (38 LOC)

- Origin: `git clone --depth=1 --branch v8.0.2 https://github.com/rails/rails.git`.
- Dest: `scripts/api-compare/.rails-source/`.
- Filtering: none (full clone). Per PR #1483, sparse-checkout was removed; the script auto-migrates pre-#1483 sparse mirrors by disabling sparse-checkout.
- Idempotency: skips when `.git` exists; rewrites the sparse flag if set.
- Consumers: `extract-ruby-api.rb`, `start-worktree.sh` (symlinks the existing mirror into each new worktree to avoid re-cloning), `extract-ruby-tests.rb`.

### 1.2 `scripts/test-compare/fetch-rails-tests.sh` (70 LOC)

- Two origins handled in one script:
  - **Rails**: verifies `../api-compare/.rails-source/` exists; does NOT clone (delegates to `fetch-rails.sh`). Asserts 8 required test directories are present and reports file counts.
  - **Rack**: clones `https://github.com/rack/rack.git @ v3.1.14` into `../api-compare/.rack-source/`. The path lives under `api-compare/` so `start-worktree.sh:154-155` can symlink both Ruby sources from one parent dir; nothing in `api-compare/` actually reads `.rack-source/`.
- Idempotency: per-origin skip.
- Consumers: `extract-ruby-tests.rb`.
- Smell: the verification half overlaps `fetch-rails.sh`; the rack half is a hidden second fetcher.

### 1.3 `scripts/globalid-source/fetch-globalid.sh` (17 LOC)

- Origin: `bundle install` against a 2-line `Gemfile` pinning `globalid 1.3.0`.
- Dest: `scripts/globalid-source/vendor/bundle/ruby/<ruby-version>/gems/globalid-<version>/`.
- Idempotency: skips when `vendor/bundle` exists.
- Consumers: **none today.** Not referenced in `api-compare/`, `test-compare/`, or `start-worktree.sh`. It is dead infrastructure.

### 1.4 Duplication tally

| Concern                       | rails  | rails-tests  | globalid | unified               |
| ----------------------------- | ------ | ------------ | -------- | --------------------- |
| `SCRIPT_DIR` resolution       | 1 line | 1 line       | 1 line   | shared util           |
| Idempotency check             | 8 LOC  | 5 LOC        | 4 LOC    | 1 helper              |
| Git clone invocation          | 8 LOC  | 6 LOC (rack) | —        | `gitFetcher`          |
| Bundler vendoring             | —      | —            | 5 LOC    | `bundlerFetcher`      |
| Required-dir verification     | —      | 28 LOC       | —        | declarative (schema)  |
| Path constants (rb consumers) | 1      | 2            | 0        | `sources.resolvePath` |

Of 125 LOC across the three scripts, ~60 LOC is plumbing that disappears under a single fetcher.

### 1.5 Path-hardcoding consumers

```
scripts/api-compare/extract-ruby-api.rb:14    RAILS_DIR = File.join(SCRIPT_DIR, ".rails-source")
scripts/test-compare/extract-ruby-tests.rb:18 RAILS_DIR = File.join(SCRIPT_DIR, "..", "api-compare", ".rails-source")
scripts/test-compare/extract-ruby-tests.rb:19 RACK_DIR  = File.join(SCRIPT_DIR, "..", "api-compare", ".rack-source")
scripts/start-worktree.sh:154                 link_source "scripts/api-compare/.rails-source"
scripts/start-worktree.sh:155                 link_source "scripts/api-compare/.rack-source" optional
scripts/parity/schema/ruby/Gemfile:5          # version pinned by COMMENT — drifts silently from RAILS_TAG
```

The Ruby extractors will need a small env-var or stdin contract to receive resolved paths from a TS caller (the extractors themselves stay in Ruby — they shell out from Node anyway).

## 2. Source-list schema design

User chose **`vendor/`** at repo root as the layout, **TypeScript (tsx)** as the fetcher language. Schema lives at `vendor/sources.ts`; resolved sources land under `vendor/<name>/<package>/...`.

### 2.1 Three shapes considered

**Shape A — flat list, monorepos split out at the consumer.**

```ts
type UpstreamSource =
  | { name: "actionpack"; origin: GitOrigin; subdir: "actionpack" }
  | { name: "activerecord"; origin: GitOrigin; subdir: "activerecord" }
  | ...;
```

Pro: one entry per consumed package. Con: 8+ entries all sharing one git ref means duplication; a Rails version bump touches every entry; cross-package consistency is an ad-hoc invariant.

**Shape B — one entry per origin, packages declared inside.** (Selected.)

```ts
interface UpstreamSource {
  name: string; // "rails", "rack", "globalid" — used as vendor/<name>/
  origin:
    | { type: "git"; url: string; ref: string }
    | { type: "rubygems"; gem: string; version: string };
  packages: Array<{
    name: string; // "activerecord", "globalid"; surfaces in api-compare PACKAGES
    libPath: string; // relative to vendored root (origin-specific)
    testPath?: string; // optional; omitted = test-compare ignores
  }>;
}
```

Pro: one origin = one fetch = one cache invalidation. Versioning is monorepo-aware. Easy to enumerate packages for downstream tools.

**Shape C — two-layer (origins + packages as separate tables).** Pro: dedupe across origins (none today). Con: indirection without payoff at current scale.

**Decision**: Shape B. Revisit if any origin grows >10 packages.

### 2.2 Concrete list (initial migration target)

```ts
export const SOURCES: UpstreamSource[] = [
  {
    name: "rails",
    origin: { type: "git", url: "https://github.com/rails/rails.git", ref: "v8.0.2" },
    packages: [
      { name: "activerecord", libPath: "activerecord/lib", testPath: "activerecord/test" },
      { name: "activemodel", libPath: "activemodel/lib", testPath: "activemodel/test" },
      { name: "activesupport", libPath: "activesupport/lib", testPath: "activesupport/test" },
      { name: "actionpack", libPath: "actionpack/lib", testPath: "actionpack/test" },
      { name: "actionview", libPath: "actionview/lib", testPath: "actionview/test" },
      { name: "actionmailer", libPath: "actionmailer/lib", testPath: "actionmailer/test" },
      { name: "railties", libPath: "railties/lib", testPath: "railties/test" },
    ],
  },
  {
    name: "rack",
    origin: { type: "git", url: "https://github.com/rack/rack.git", ref: "v3.1.14" },
    packages: [{ name: "rack", libPath: "lib", testPath: "test" }],
  },
  {
    name: "globalid",
    origin: { type: "rubygems", gem: "globalid", version: "1.3.0" },
    packages: [{ name: "globalid", libPath: "lib", testPath: "test" }],
  },
];
```

A separate `parity/` Gemfile still needs the `activerecord 8.0.2` pin to match `rails.origin.ref` — wave 7 plumbs it through.

## 3. Unified fetcher

`vendor/fetch.ts` (tsx-runnable, single entrypoint):

```ts
// CLI: tsx vendor/fetch.ts [--source <name>] [--refresh]
// Default: fetches all sources, idempotent.
// --source: limit to one entry by name.
// --refresh: rm -rf the dest, re-fetch.
```

Internals:

- `loadSources()` — imports `vendor/sources.ts`, validates with a tiny zod-free runtime check.
- `gitFetcher({ url, ref, dest })` — `git clone --depth=1 --branch <ref> <url> <dest>` if `<dest>/.git` missing; tags refs as pinned, no `git pull`.
- `bundlerFetcher({ gem, version, dest })` — writes an ephemeral `Gemfile` in `<dest>`, `bundle config set --local path vendor/bundle`, `bundle install`, then **symlinks** `<dest>/lib` → the deepest `vendor/bundle/ruby/*/gems/<gem>-*/lib` so the on-disk shape matches git origins. (Without this, `libPath: "lib"` lies for rubygems sources.)
- `verifyPackages(source)` — for each declared `package`, asserts `libPath` and (if set) `testPath` exist under the resolved root; counts test files for the human-readable summary.

Normalized layout after fetch:

```
vendor/
  rails/                          (git clone of rails/rails)
    activerecord/lib/...
    activerecord/test/...
    ...
  rack/                           (git clone of rack/rack)
    lib/...
    test/...
  globalid/                       (bundler vendor + symlinks)
    lib/                          → vendor/bundle/.../globalid-1.3.0/lib
    test/                         → vendor/bundle/.../globalid-1.3.0/test
    vendor/bundle/...
```

**CI policy**: fetcher runs on every CI job that needs Ruby sources (`api:compare`, `test:compare`); cache key = hash of `vendor/sources.ts`. No periodic refresh — refs are pinned; bumping a `ref` invalidates the cache deterministically. Local dev: `pnpm vendor:fetch` (alias to `tsx vendor/fetch.ts`).

## 4. Downstream integration

A tiny TS helper exported from `vendor/sources.ts`:

```ts
export function resolvePath(packageName: string, kind: "lib" | "test" = "lib"): string {
  // returns absolute path; throws if package not in SOURCES or kind not declared
}
```

Consumers migrate as follows:

- `scripts/api-compare/config.ts` — drops `PACKAGES` literal; derives it from `SOURCES.flatMap(s => s.packages.map(p => p.name))` filtered against the TS packages that exist under `packages/`. `PACKAGE_DIR_OVERRIDES` stays (it's a TS-side concern).
- `scripts/api-compare/extract-ruby-api.rb` — receives `RAILS_DIR` via env var set by its TS caller (`compare.ts`), which calls `resolvePath("activerecord", "lib")` etc. Removes the hardcoded `File.join(SCRIPT_DIR, ".rails-source")`.
- `scripts/test-compare/extract-ruby-tests.rb` — same env-var contract. Iterates over a JSON-encoded source manifest passed by the caller.
- `scripts/start-worktree.sh` — replaces per-source `link_source "scripts/api-compare/.rails-source"` calls with one loop over `tsx vendor/fetch.ts --print-paths`. That flag emits one absolute path per line (one per source name, e.g. `/.../vendor/rails`), and the shell loop symlinks each into the new worktree's `vendor/<name>`.
- Memory entry `reference_rails_source_path.md` — updated in wave 7 to point at `vendor/rails/` and at `resolvePath`.

## 5. Globalid as proof

State today: globalid has a fetcher but **zero downstream wiring**. Grep confirms no references in `scripts/api-compare/` or `scripts/test-compare/`. The TS package `@blazetrails/globalid` would need to land in `PACKAGES` (it isn't there as of `config.ts:7-17`).

Validation flow once the design lands:

1. Add globalid to `SOURCES` (already in §2.2).
2. Add `globalid` to the TS package list, or rely on `PACKAGES` being derived from `SOURCES` (preferred — that's the whole point).
3. Run `pnpm vendor:fetch --source globalid`; the fetcher symlinks the gem's `lib/` and `test/` under `vendor/globalid/`.
4. `pnpm api:compare` and `pnpm test:compare` pick it up automatically.

Test count: deferred. The rubygems tarball isn't checked out in this worktree (`scripts/globalid-source/vendor/` is in `.gitignore` and empty in the planning environment), so the count is whatever `find vendor/globalid/test -name "*_test.rb" | wc -l` reports after wave 3 fetches it. Wave 6 quotes the number.

## 6. Migration waves

Each wave ≤300 LOC. Order chosen so each wave is independently shippable and reversible.

| #   | Wave                                                                                                                           | Est. LOC | Touches                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Define `vendor/sources.ts` schema + the list (Rails only).                                                                     | ~100     | `vendor/sources.ts`, `vendor/README.md`                                                                          |
| 2   | Unified fetcher with `git` origin; migrate Rails + Rack.                                                                       | ~200     | `vendor/fetch.ts`; delete `fetch-rails.sh`, rack half of `fetch-rails-tests.sh`; update CI + `start-worktree.sh` |
| 3   | Add `rubygems` origin; migrate globalid.                                                                                       | ~150     | extend `fetch.ts`; delete `fetch-globalid.sh` + `scripts/globalid-source/`                                       |
| 4   | `api-compare` reads from `resolvePath`; derive `PACKAGES`; thread Rails tag into extractor cache key.                          | ~150     | `config.ts`, `compare.ts`, `extract-ruby-api.rb` env contract + cache-gate (line 17)                             |
| 5   | `test-compare` reads from `resolvePath`; verify replaces required-dir block.                                                   | ~150     | `test-compare.ts`, `extract-ruby-tests.rb`, delete rest of `fetch-rails-tests.sh`                                |
| 6   | Globalid wiring: confirms PACKAGES auto-pickup; quote test count.                                                              | ~50      | `vendor/sources.ts` (no change), `globalid` parity baseline added                                                |
| 7   | Doc + memory + Gemfile cleanup; update `reference_rails_source_path.md`; align `parity/schema/ruby/Gemfile` version to schema. | ~100     | docs, memory, `parity/schema/ruby/Gemfile`                                                                       |

Waves 4 and 5 can land in either order; they are independent.

## 7. Risks and open questions

- **CI cache invalidation**: cache key must be `hash(vendor/sources.ts)`, not a dir hash — otherwise a pinned-ref bump won't invalidate.
- **Bundler in CI**: globalid (and any future rubygems-origin source) requires `ruby` + `bundler` on the CI image. `api:compare` and `test:compare` already use Ruby for the extractors, so no new dep — but it does mean a TS-only contributor cannot run `pnpm vendor:fetch` without Ruby installed. Mitigation: `fetch.ts` should print an actionable error ("install ruby + bundler") rather than letting `bundle install` fail.
- **In-flight worktrees during migration**: agents currently symlinked to `scripts/api-compare/.rails-source` will see broken symlinks the moment wave 2 lands. Mitigation: wave 2 leaves a deprecation symlink at `scripts/api-compare/.rails-source` → `../../vendor/rails/` (and same for rack). The compat symlink stays until wave 7 deletes it. Wave 2 should also reuse the existing master clone via `git mv scripts/api-compare/.rails-source vendor/rails` rather than re-cloning — saves ~53 MiB and a slow clone on every active agent's machine.
- **Extractor cache gate**: `scripts/api-compare/extract-ruby-api.rb:17` already caches extraction output keyed by Rails tag. Once the tag moves into `vendor/sources.ts`, the extractor must read it from the manifest (env var passed by `compare.ts`) or the cache key drifts silently. Wave 4 owns this.
- **Cross-doc coordination**: the parallel `docs/rails-file-structure-mirror-plan.md` (in progress on agent %396) is designing a Ruby-aware mirror tool that **must** consume the same `SOURCES` list. Both plans should converge on `vendor/sources.ts` as the single registry. Action item: cross-link this doc from the mirror plan when it lands.
- **`parity/schema/ruby/Gemfile` drift**: today the version is in a comment. Wave 7 should either (a) generate the Gemfile from `vendor/sources.ts` at parity-run time, or (b) make the parity script assert `rails.origin.ref === activerecord Gemfile version` on startup.
- **Symlink semantics for rubygems origin**: the `vendor/globalid/lib → vendor/globalid/vendor/bundle/.../lib` symlink approach assumes POSIX. Windows is unsupported by the repo today (Ruby + pnpm + symlinks), so this is acceptable but worth flagging.

## 8. Out of scope

- Implementing the waves (each is its own PR).
- Mirroring non-Ruby upstream sources (Postgres grammar, MySQL grammar, etc.).
- Vendoring upstream gems into the shipped npm packages (this is dev-tool sourcing only).
- Cron / periodic refresh — pinned refs make refresh deterministic; the question belongs to a CI plan, not here.
- `@blazetrails/arel` origin decision — explicitly out of scope per kickoff.
- Per-test exclusions or skip-management — orthogonal to fetching.

## 9. Cross-references

- `docs/rails-file-structure-mirror-plan.md` — parallel plan; must consume the same `vendor/sources.ts`.
- `scripts/api-compare/conventions.ts` — naming-exception registry; unaffected by this work but consulted by downstream tools that _do_ change.
- PR #1483 — full clone replaced sparse-checkout in `fetch-rails.sh`; the new fetcher inherits the same full-clone policy.
- Memory: `reference_rails_source_path.md` — must be updated in wave 7.
- `scripts/parity/schema/ruby/Gemfile:5` — silent version drift risk; wave 7 ties it to `SOURCES`.
