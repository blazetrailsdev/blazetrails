# Associations gap plan

339 skipped tests across 33 files. This plan organizes the gaps into
PR-sized work items (~150–300 LOC each), ordered by unlock potential
(tests unblocked per PR).

---

## Track 1: Preloader core (unlocks ~104 eager-loading + ~18 cascaded tests)

### PR A1: Preloader writes to real association target, not shadow map

**Problem:** `_associateRecordsToOwner` and `associateRecordsFromUnscoped`
write to `_preloadedAssociations` instead of calling
`owner.association(name).target = records`. The real proxy stays unloaded,
unpersisted collection members are dropped, and `association.loaded?` is
false after preloading.

**Files:**

- `associations/preloader/association.ts:228–252` — `_associateRecordsToOwner`
- `associations/preloader/association.ts:192–222` — `associateRecordsFromUnscoped`

**Rails ref:** `preloader/association.rb:245–256`

**Est:** ~80 LOC

---

### PR A2: `_buildScope` parity — `scope_for_association` + `cascade_strict_loading`

**Problem:** `_buildScope` uses `_allForPreload()` instead of
`klass.scope_for_association` (may miss `default_scope`). The
`cascadeStrictLoading` helper exists (line 563) but is never called.

**Files:**

- `associations/preloader/association.ts:296–320` — `_buildScope`
- `associations/preloader/association.ts:563` — dead `cascadeStrictLoading`

**Rails ref:** `preloader/association.rb:295–307`

**Est:** ~60 LOC

---

### PR A3: `groupedRecords` polymorphic guard + HABTM-through detection

**Problem:** `groupedRecords` swallows all exceptions via try/catch instead
of Rails' targeted `polymorphic_parent && !reflection` guard. HABTM-through
detection uses fragile `_associations` array scan instead of
`reflection.options.through`.

**Files:**

- `associations/preloader/branch.ts:153–177` — `groupedRecords`
- `associations/preloader/branch.ts:299–319` — `_preloaderFor`

**Rails ref:** `preloader/branch.rb:80–89`

**Est:** ~60 LOC

---

### PR A4: Through-association scope + STI source grouping

**Problem:** `_buildThroughScope` ignores the through reflection's
`join_scopes` — custom scopes on intermediates are dropped.
`_getSourcePreloaders` doesn't group by STI class at the source level.

**Files:**

- `associations/preloader/through-association.ts:351–376` — `_buildThroughScope`
- `associations/preloader/through-association.ts:171–197` — `_getSourcePreloaders`

**Rails ref:** `preloader/through_association.rb`

**Est:** ~100 LOC

---

### PR A5: `eager_load` nested hash specs → JoinDependency (not preload fallback)

**Problem:** `_executeEagerLoad` pushes all non-string and dotted-string
specs into `fallbackAssocs`, so nested `eagerLoad({ author: :posts })`
silently degrades to N preload queries instead of JOINing.
`_includesToPromoteFromReferences` only promotes flat strings, not nested
hashes.

**Files:**

- `relation.ts:2108–2116` — `_executeEagerLoad` fallback logic
- `relation.ts:2010–2011` — `_includesToPromoteFromReferences`

**Rails ref:** `relation/finder_methods.rb`, `associations/join_dependency.rb`

**Est:** ~150 LOC (highest complexity in this track)

---

## Track 2: has_many :through writes (unlocks ~40 tests)

### PR B1: `buildRecord` override for HMT

**Problem:** No `buildRecord` override — `post.comments.build()` on a HMT
returns a target record with no join row created and no inverse wired.

**Files:**

- `associations/has-many-through-association.ts` — add `buildRecord` override

**Rails ref:** `has_many_through_association.rb:90–114`

**Est:** ~80 LOC

---

### PR B2: `concatRecords` + `@through_records` cache

**Problem:** No `concatRecords` override — new-record owners never pre-build
through rows for `after_create`. No per-record `@through_records` cache or
`ensure`-clear after save.

**Files:**

- `associations/has-many-through-association.ts` — add `concatRecords`, add cache

**Rails ref:** `has_many_through_association.rb:37–49`, `81–88`

**Est:** ~100 LOC

---

### PR B3: `deleteRecords` + `removeRecords` join-table operations

**Problem:** `deleteRecords` is a stub that delegates to `.delete()` instead
of scoped join-table `destroy_all`/`update_all`/`delete_all`.
`removeRecords` never calls `deleteThroughRecords` (exists at line 306,
dead code).

**Files:**

- `associations/has-many-through-association.ts:240–246` — `deleteRecords`
- `associations/has-many-through-association.ts:206–213` — `removeRecords`
- `associations/has-many-through-association.ts:306` — `deleteThroughRecords`

**Rails ref:** `has_many_through_association.rb:116–175`

**Est:** ~120 LOC

---

## Track 3: inverse_of (unlocks ~23 tests)

### PR C1: `inverseAssociationFor` → `reflection.inverseName()`

**Problem:** `inverseAssociationFor()` reads `reflection.options.inverseOf`
directly but never calls `reflection.inverseName()`, which is what performs
automatic inverse detection via `automaticInverseOf()`. When `inverseOf` is
not explicitly set, inverse sharing is silently skipped.

**Files:**

- `associations/association.ts:431` — `inverseAssociationFor`

**Rails ref:** `reflection.rb` `inverse_name` / `automatic_inverse_of`

**Est:** ~20 LOC (small change, large blast radius — test thoroughly)

---

### PR C2: `setInverseInstance` on collection `concat`/`push`

**Problem:** `CollectionAssociation#concat`/`push`/`<<` does not call
`setInverseInstance` on each appended record.

**Files:**

- `associations/collection-association.ts` — `addToTarget` / `replaceOnTarget`

**Rails ref:** `collection_association.rb` `replace_on_target`

**Est:** ~40 LOC

---

### PR C3: Preloader inverse wiring for non-rich reflections

**Problem:** `_associateRecordsToOwner` derives `inverseName` from
`reflection.inverseOf?.()?.name ?? options?.inverseOf` — only works when
rich reflection is attached. Falls back to `options.inverseOf` only,
missing automatic detection.

**Files:**

- `associations/preloader/association.ts:239–241`

**Depends on:** PR C1 (once `inverseName()` works, this path can call it)

**Est:** ~30 LOC

---

## Track 4: has_one (unlocks ~27 tests, ~24 fixture-gated)

### PR D1: `AssociationTypeMismatch` named error class

**Problem:** `replace()` calls `raiseOnTypeMismatchBang` but the error is a
generic `Error`, not the Rails-named `AssociationTypeMismatch` class.

**Files:**

- `associations/has-one-association.ts:101`
- `associations/errors.ts` — add `AssociationTypeMismatch`

**Est:** ~30 LOC

---

### PR D2: has_one fixture bodies

**Problem:** ~24 of 27 skips are `/* fixture-dependent */` — the has_one
implementation is largely complete but tests lack data.

**Depends on:** Phase G fixture adoption (see `project_phase_g_fixture_adoption_epic.md`)

**Est:** ~200 LOC (test bodies only)

---

## Track 5: Collection callbacks (unlocks ~12 tests)

### PR E1: Unify callback dispatch + abort semantics

**Problem:** `replaceOnTarget` reads `options.beforeAdd` directly;
`removeRecords` reads from `callbacksFor()`. Two dispatch paths. Neither
supports abort semantics (Rails `catch(:abort)`). `concatRecords` still
saves to DB even when `beforeAdd` returns false.

**Files:**

- `associations/collection-association.ts:689–780` — `removeRecords`, `replaceOnTarget`
- `associations/collection-association.ts:155–158` — `concatRecords`

**Rails ref:** `collection_association.rb` `replace_on_target`, `remove_records`

**Est:** ~100 LOC

---

### PR E2: `create()` goes through `addToTarget` + dedup tracking

**Problem:** `CollectionProxy#create()` manually pushes to `_target` and
fires callbacks directly, bypassing `addToTarget`. Skips
`setInverseInstance` and `replaced_or_added_targets` dedup.

**Files:**

- `associations/collection-proxy.ts:771–778` — `create()`
- `associations/collection-association.ts:748–780` — add `replaced_or_added_targets` set

**Rails ref:** `collection_association.rb` `replace_on_target`,
`collection_proxy.rb` `create`

**Est:** ~80 LOC

---

## Dependency graph

```
A1 ──┐
A2   ├── A5 (eager_load JOIN path needs working preloader first)
A3 ──┤
A4 ──┘

B1 → B2 → B3 (each builds on prior HMT plumbing)

C1 → C2 → C3 (inverseName() must work before wiring it into collection/preloader)

D1 (standalone)
D2 (blocked on Phase G fixtures)

E1 → E2 (unified dispatch before create() can use it)
```

## Priority order

| #   | PR  | Tests unlocked            | Depends on |
| --- | --- | ------------------------- | ---------- |
| 1   | A1  | ~40 (preloader target)    | —          |
| 2   | C1  | ~15 (auto inverse)        | —          |
| 3   | A3  | ~20 (polymorphic preload) | —          |
| 4   | B1  | ~15 (HMT build)           | —          |
| 5   | A2  | ~10 (scope/strict)        | —          |
| 6   | B3  | ~15 (HMT delete)          | —          |
| 7   | A4  | ~15 (through scope/STI)   | —          |
| 8   | E1  | ~8 (callback abort)       | —          |
| 9   | C2  | ~5 (inverse on push)      | C1         |
| 10  | B2  | ~10 (HMT concat)          | B1         |
| 11  | E2  | ~4 (create dedup)         | E1         |
| 12  | D1  | ~3 (type mismatch)        | —          |
| 13  | A5  | ~20 (nested eager_load)   | A1–A4      |
| 14  | C3  | ~3 (preloader inverse)    | C1         |
| 15  | D2  | ~24 (has_one fixtures)    | Phase G    |
