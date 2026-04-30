# Docs index

Snapshot 2026-04-30. Every plan/audit/tracker doc in `docs/`, grouped by what
it's for, with current priority and rough remaining-work size.

Priority legend:

- **P0** — blocks launch / on the launch roadmap critical path
- **P1** — active core-package work, near completion or in-flight
- **P2** — useful but non-blocking; long tail
- **P3** — design / proposal / aspirational; not actively executing

Work-size legend (rough order-of-magnitude):

- **S** — < 5 PRs
- **M** — 5–15 PRs
- **L** — 15–40 PRs
- **XL** — 40+ PRs

---

## Launch / cross-cutting

| Doc                                                            | Priority | Work | Notes                                                                                             |
| -------------------------------------------------------------- | -------- | ---- | ------------------------------------------------------------------------------------------------- |
| [`launch-roadmap.md`](launch-roadmap.md)                       | P0       | —    | The "what blocks public launch" doc. Everything else feeds into this.                             |
| [`virtual-source-files-plan.md`](virtual-source-files-plan.md) | P0       | M    | Phase 1 done; **Phase 2 (tsserver plugin)** is the open work. 6 sub-PRs (2.1–2.6) + Phase 3 docs. |
| [`temporal-migration-plan.md`](temporal-migration-plan.md)     | P1       | S    | Migration done. Only F-6a..h sweep left (~30 helpers across 4 activesupport files).               |

## Per-package "Road to 100%" trackers

Live numbers come from `pnpm api:compare --package <name>` and
`pnpm test:compare`; doc snapshots may lag. Re-check before scoping.

| Doc                                                                    | api:compare               | Priority | Work | Notes                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------- | -------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| [`activerecord-100-percent.md`](activerecord-100-percent.md)           | 88% (incl priv)           | P1       | L    | Public surface near-done; private parity tracked in `private-api-parity-100-plan.md`.                                   |
| [`activemodel-privates-100-plan.md`](activemodel-privates-100-plan.md) | 99.1% / ~83% priv         | P1       | S–M  | Track A done. Tracks B + C are small. **Track D** (readAttribute → MissingAttributeError) is its own ~6-PR initiative.  |
| [`actioncontroller-100-percent.md`](actioncontroller-100-percent.md)   | 57%                       | P1       | L    | Merged with the privates backlog: 4 waves remaining. Biggest gaps: http_authentication (33), test_case (32), live (17). |
| [`actiondispatch-100-percent.md`](actiondispatch-100-percent.md)       | 4.9% (api), 30.9% (tests) | P2       | XL   | Missing tests, not stubs. Primarily feature porting + test reconciliation.                                              |
| [`activesupport-100-percent.md`](activesupport-100-percent.md)         | 24.7%                     | P2       | XL   | Snapshot lags; trickled in alongside other work.                                                                        |
| [`private-api-parity-100-plan.md`](private-api-parity-100-plan.md)     | 88% AR priv               | P1       | L    | Tier 1/2/4 done. Tier 3 (adapters, ~310 methods, ~16 PRs) is the next big block. Tiers 5–7 in parallel.                 |

## Plans / backlogs

| Doc                                                          | Priority | Work | Notes                                                                                                                                                  |
| ------------------------------------------------------------ | -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`arel-alignment-plan.md`](arel-alignment-plan.md)           | P1       | M    | Behavioral fidelity (api:compare already 100%). 17 PRs remaining across 4 waves; in active progress.                                                   |
| [`test-compare-100-plan.md`](test-compare-100-plan.md)       | P1       | XL   | AR tests at 71.8% (5872/8177). Phase 1 has ~30 single-feature PRs; Phases 2–3 cover PG / MySQL adapter polish (~450 tests).                            |
| [`trailties-plan.md`](trailties-plan.md)                     | P2       | XL   | Phase 0 done. Greenfield from Phase 1 onward — Paths, Initializable, generators, Engine, Application — ~30 PRs minimum.                                |
| [`ci-improvement-plan.md`](ci-improvement-plan.md)           | P2       | M    | Phase 0 mostly shipped. Phase 1 is the real work: composite setup action, shared build artifact, SQLite parallelism. Phase 2 = matrix + DB-per-worker. |
| [`ar-query-parity-gap-plan.md`](ar-query-parity-gap-plan.md) | P2       | S    | Single remaining gap tracked in `scripts/parity/canonical/query-known-gaps.json`.                                                                      |

## Design proposals (not started)

| Doc                                                            | Priority | Work | Notes                                                                                                               |
| -------------------------------------------------------------- | -------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| [`relation-bound-attributes.md`](relation-bound-attributes.md) | P3       | M    | `Substitute → BindParam` pipeline for `StatementCache.create`. Design only; nothing wired yet.                      |
| [`quoting-refactor.md`](quoting-refactor.md)                   | P3       | M    | Thread adapter through every `quote`/`quoteIdentifier` call site. Design; standalone-function pattern still in use. |

## Verification harnesses

| Doc                                                                                      | Priority | Work | Notes                                                                                         |
| ---------------------------------------------------------------------------------------- | -------- | ---- | --------------------------------------------------------------------------------------------- |
| [`activerecord-rails-parity-verification.md`](activerecord-rails-parity-verification.md) | P1       | —    | Schema parity pipeline — implementation contract. Living reference, not a "complete it" plan. |
| [`query-parity-verification.md`](query-parity-verification.md)                           | P1       | —    | Query parity pipeline — extends schema parity. Same shape, same fixtures.                     |

## Audits (point-in-time snapshots)

These are read-once references. Don't actively prune them — they're a record
of what was true at the audit date and inform plan PRs cited in their wake.

| Doc                                                                    | Date       | Notes                                                                     |
| ---------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| [`activemodel-audit.md`](activemodel-audit.md)                         | 2026-04-26 | Source for activemodel parity PRs; large (569 lines). Mostly executed.    |
| [`activerecord-dependency-audit.md`](activerecord-dependency-audit.md) | —          | Reimplementation-vs-sibling-package and raw-SQL audit; informs refactors. |

---

## What to delete next

If you're looking for low-hanging cleanup:

- `activemodel-audit.md` is mostly executed — could become a deletion candidate after one more sweep against current state.
- `activesupport-100-percent.md` is so stale it may be net-negative; defer to live `api:compare` instead.
- `frontiers/` is a separate workstream (WS1/2/3) outside the package work — leave alone.
