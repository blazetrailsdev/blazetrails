# Adapter Access Cleanup Plan

Goal: eliminate raw `._adapter` field reads and construction-time adapter
caching. Every site should resolve the adapter through the class getter
(`Model.adapter` → pool checkout) at point-of-use, matching Rails'
`klass.connection` semantics.

This is scoped as story-sized PRs (~150–250 LOC each).

---

## Story 1 — Relation arel-visitor: kill raw `._adapter` reads

**Files:** `relation.ts`  
**Lines:** 3615, 3628, 3634  
**Problem:** `(this._modelClass as any)._adapter` bypasses the getter; returns
null if getter never fired.  
**Fix:** Replace with `this._modelClass.adapter` (the getter). Remove the `as any`
casts. The `_arelVisitor()` helper and `get _visitor()` should both go through
the public getter.  
**LOC:** ~30

---

## Story 2 — Preloader association: remove `._adapter` cache-key read

**Files:** `associations/preloader/association.ts`  
**Line:** 385  
**Problem:** `klass._adapter` used as a dedup key for `LoaderQuery` cache.  
**Fix:** Use `klass.adapter` (getter). If the concern is performance of
repeated getter calls, assign to a local at the top of the method.  
**LOC:** ~15

---

## Story 3 — QueryMethods: remove double-fallback adapter resolution

**Files:** `relation/query-methods.ts`  
**Line:** 148  
**Problem:** `(host._modelClass as any)?.adapter ?? (host._modelClass as any)?._adapter`
— two-level bypass with `as any`.  
**Fix:** Single call to `host._modelClass.adapter`. If the type doesn't expose
it, fix the type constraint on the host (should be `typeof Base`).  
**LOC:** ~20

---

## Story 4 — InsertAll: fetch connection at execution, not construction

**Files:** `insert-all.ts`  
**Lines:** 67, 73, and all `this._connection` usages (~15 sites)  
**Problem:** `model.adapter` stored at construction; stale if connection swaps.  
**Fix:** Store model class ref instead. Add a private `get _connection()` that
calls `this._model.adapter` at point-of-use. Replace `this._connection` reads
with the getter.  
**LOC:** ~80

---

## Story 5 — JoinDependency: resolve adapter at use, not construction

**Files:** `associations/join-dependency.ts`  
**Lines:** 140–168, plus all `this._adapter` usages  
**Problem:** Adapter frozen at construction time.  
**Fix:** Same pattern as Story 4 — store the base model class, add a private
getter that resolves through `baseModel.adapter` when quoting is needed.
Remove `_resolveAdapter` static helper.  
**LOC:** ~60

---

## Story 6 — Uniqueness validator: drop `adapter ?? connection` double-path

**Files:** `validations/uniqueness.ts`  
**Line:** 303  
**Problem:** `klass.adapter ?? klass.connection ?? null` — the fallback chain
suggests uncertainty about which path is live.  
**Fix:** Single `klass.adapter` call (the getter IS the connection path).
Remove dead `klass.connection` reference if it exists.  
**LOC:** ~10

---

## Story 7 — primary-key.ts: remove adapter from type signature

**Files:** `attribute-methods/primary-key.ts`  
**Lines:** 199–205  
**Problem:** `this: PrimaryKeyHost & { adapter?: DatabaseAdapter }` — the
`adapter` constraint is in the host type signature. Rails' `quoted_primary_key`
calls `connection.quote_column_name`.  
**Fix:** Remove `adapter` from the host type. Resolve via `this.adapter` (Base
getter). Ensure `PrimaryKeyHost` extends or is constrained to `typeof Base`.  
**LOC:** ~20

---

## Ordering

Stories 1–3 and 6–7 are independent leaf fixes (no API change, just internal
resolution path). Ship in any order or bundle adjacent ones.

Stories 4–5 are slightly larger refactors that change how objects hold
references. Ship after 1–3 to reduce concurrent churn in `relation.ts`.

## Non-goals (this plan)

- Renaming `adapter` → `connection` across the codebase (separate initiative)
- Removing `Base.adapter = X` setter (Phase D epic scope)
- Adding `withConnection { }` block semantics (future pool lifecycle work)
