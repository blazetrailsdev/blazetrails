# CI Improvement Plan

Focus: separate the actionpack test footprint from activerecord at the
CI level, ahead of the actionpack restructure waves
([actionpack-restructure-audit.md](actionpack-restructure-audit.md)).
Wave 7 (journey port) alone adds 1500–2000 LOC of routing engine, and
Wave 3 promotes `abstractcontroller/` to a logical top-level package
— the test surface will roughly double on the actionpack side. Today
actionpack tests are co-mingled with the other no-DB packages in a
single `unit-tests` job; this doc plans the CI split that should ride
alongside the restructure.

## Current state

`.github/workflows/ci.yml` runs actionpack tests as part of the
`unit-tests` job (lines 219–244):

```
pnpm vitest run
  packages/arel
  packages/activemodel
  packages/activesupport
  packages/rack
  packages/actionpack
  packages/actionview
  packages/trailties
  scripts/guides-typecheck
```

This single job batches all packages that don't require a database.
`packages/activerecord` runs in three separate adapter jobs
(`sqlite-tests`, `postgres-tests`, `mariadb-tests`) — each does a
full `pnpm install` and `pnpm vitest run packages/activerecord`,
gated on DB services.

Baseline counts (2026-05-14):

- `find packages/actionpack/src -name '*.test.ts' | wc -l` → **64**
  test files (37 under `actioncontroller/`, 27 under `actiondispatch/`).
- `packages/actionpack` has **no DB driver dependency** — tests are
  pure unit tests over the Rack stack.
- Cross-package tests that exercise actionpack + AR together do
  exist (controller/integration test helpers reach into AR fixtures),
  but they're a minority and live under `packages/actionpack` today.

## Recommended separation

**Option (a): dedicated `actionpack-tests` job.** Recommended.

Split actionpack out of `unit-tests` into its own no-DB job:

```yaml
actionpack-tests:
  name: Action Pack Tests
  needs: changes
  if: needs.changes.outputs.docs_only != 'true'
  runs-on: ubuntu-latest
  timeout-minutes: 30
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 10.27.0
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm vitest run packages/actionpack
```

Justification:

- Today's `unit-tests` job batches 7 packages. After Wave 7 the
  journey port roughly doubles actiondispatch's test surface
  (27 → ~50+ files), making actionpack the largest single contributor
  to that job. Splitting gives clearer signal on actionpack
  regressions and lets the rest of `unit-tests` finish faster.
- No DB setup needed → fastest job class in the matrix; provides
  a fast-fail channel separate from the AR adapter jobs.
- Parallel-safe by construction (no shared DB state), so vitest's
  default file parallelism applies — no `--no-file-parallelism`
  needed, unlike AR.

**Option (b): per-subpackage jobs** (`abstractcontroller-tests`,
`actioncontroller-tests`, `actiondispatch-tests`). Rejected for now.
Sub-jobs only pay off when each subpackage exceeds ~5 CI minutes
on its own. At ~64 total test files today and ~100 projected
post-Wave-7, one job is the right granularity. Revisit if
actiondispatch's journey port pushes wall-time past ~5 min.

**Option (c): vitest workspace config to opt-out of DB setup.**
Rejected — actionpack already has no DB setup to opt out of. The
problem isn't intra-job; it's that AR's slow critical path
shouldn't block actionpack feedback (and vice versa).

## Sequencing

Land the CI split as a **Wave 1.5 PR**, after Wave 1 (skeleton)
but before Wave 7 (journey port):

- After Wave 1: `abstractcontroller/` directory exists, so the new
  job's vitest glob picks it up cleanly without later rework.
- Before Wave 7: the journey port lands a large test increment;
  having the actionpack job already split avoids slowing down
  the AR adapter feedback during that wave.

Wave 1.5 PR scope: ~50–80 LOC of `ci.yml` (new job + addition to
the `ci` aggregate's `needs:` list + removal of `packages/actionpack`
from the `unit-tests` invocation). Doc-only first (this file);
implementation PR follows.

## Cross-package integration tests

Tests that exercise actionpack + AR together (e.g. integration
test helpers that load AR fixtures through ActionController) stay
where they have DB setup — i.e. they continue to run in the
adapter jobs, not in `actionpack-tests`. Two ways to keep that
clean:

1. **Path-based.** Keep integration tests that need a DB in
   `packages/activerecord/**` (or a dedicated
   `packages/integration-tests/`), so the package-level glob
   sorts them correctly.
2. **Tag-based.** Use vitest tags / `test.skipIf(!process.env.DB_URL)`
   so a file under `packages/actionpack/` skips when run from
   the no-DB job and runs in the adapter jobs.

Recommendation: prefer (1) — path-based is consistent with how
the rest of the workflow segregates work, and avoids per-test
environment branching. A quick
`grep -rln "@blazetrails/activerecord" packages/actionpack/src`
during the Wave 1.5 PR confirms whether any such tests exist
today; if non-empty, those tests need a home decision before
the split.

## Rough LOC sizing

- `ci.yml` new job: ~30 LOC YAML.
- Remove `packages/actionpack` from `unit-tests` invocation: 1 LOC.
- Add `actionpack-tests` to the `ci` aggregate `needs:` list: 1 LOC.
- Optional: vitest config tweak if tests need a slightly different
  pool config: ~10 LOC.

Estimated total: **~50 LOC** of workflow YAML, well under the
300-LOC ceiling.

## Risks

- **Setup overhead dominates if the job is fast.** A ~30s test
  suite behind a ~1m install can be net-slower than batching.
  Mitigation: accept the wall-clock cost as a tradeoff for clearer
  signal; the no-DB job is still strictly faster than the AR
  adapter jobs and provides an independent failure channel.
- **Hidden AR dependency.** If any current actionpack test
  silently relies on AR fixtures or `@blazetrails/activerecord`
  imports, it'll fail loudly in the new no-DB job. Surface that
  as an early signal, not a regression — fix forward by either
  moving the test or declaring the dep.
- **Parallelism story.** Actionpack tests don't share DB state,
  so vitest's default file parallelism is safe — no need for
  the `--no-file-parallelism` correctness fix that AR uses. If
  any actionpack test fails under parallelism, it indicates a
  hidden shared-state bug worth fixing.
- **Aggregate gate drift.** The `ci` job at the bottom of
  `ci.yml` has an explicit allow-list of "may skip" jobs; the
  new `actionpack-tests` needs to be added to its `needs:`
  list, or it'll silently skip without blocking merges.

## Open questions

1. Should `actionpack-tests` run on every PR, or be path-gated
   to `packages/actionpack/**` from day one? (Default: every PR;
   gating can follow later, paired with a nightly full-matrix
   run so we don't ship regressions through path-filter holes.)
2. Where do cross-package integration tests actually live today —
   any under `packages/actionpack` that depend on AR fixtures?
   Confirmed by `grep -rln "@blazetrails/activerecord"
packages/actionpack/src` during the Wave 1.5 PR.
3. Does Wave 7's journey port want its own sub-job
   (`actiondispatch-tests`) up-front, or is one `actionpack-tests`
   job enough until measured wall-time says otherwise?
4. Should `packages/actionview` also split out, or stay with the
   remaining `unit-tests` batch? (Same pattern applies; defer
   until actionview's own restructure surfaces a need.)

## Cross-references

- [actionpack-restructure-audit.md](actionpack-restructure-audit.md)
  — wave plan that this CI split rides alongside (Wave 1.5,
  between skeleton and journey port).
