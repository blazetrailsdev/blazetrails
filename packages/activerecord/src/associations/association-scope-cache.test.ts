/**
 * Mirrors Rails' Association#association_scope memoization
 * (activerecord/lib/active_record/associations/association.rb:300-308):
 *
 *     def association_scope
 *       if klass
 *         @association_scope ||= ...AssociationScope.scope(self)...
 *       end
 *     end
 *
 * Reset on init and on `reload()` via `reset_scope`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Base, registerModel } from "../index.js";
import { Associations } from "../associations.js";
import { AssociationScope } from "./association-scope.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("Association scope cache", () => {
  let adapter: DatabaseAdapter;

  class CacheAuthor extends Base {
    static {
      this.attribute("name", "string");
    }
  }
  class CachePost extends Base {
    static {
      this.attribute("cache_author_id", "integer");
      this.attribute("title", "string");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    CacheAuthor.adapter = adapter;
    CachePost.adapter = adapter;
    registerModel("CacheAuthor", CacheAuthor);
    registerModel("CachePost", CachePost);
    (CacheAuthor as any)._associations = [];
    (CachePost as any)._associations = [];
    Associations.hasMany.call(CacheAuthor, "cachePosts", {
      className: "CachePost",
      foreignKey: "cache_author_id",
    });
  });

  it("AssociationScope.scope is called once across repeated loads (memoized)", async () => {
    const author = await CacheAuthor.create({ name: "A" });
    await CachePost.create({ cache_author_id: author.id, title: "p1" });
    await CachePost.create({ cache_author_id: author.id, title: "p2" });

    const spy = vi.spyOn(AssociationScope, "scope");

    // Materialize the Association instance so the cache path is taken.
    const assoc = (author as any).association("cachePosts");
    expect(assoc).toBeDefined();

    await assoc.loadTarget();
    const callsAfterFirst = spy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Re-load via the same proxy; cached scope should serve.
    await assoc.reload(); // resets cache + reloads
    const callsAfterReload = spy.mock.calls.length;
    expect(callsAfterReload).toBeGreaterThan(callsAfterFirst);

    // Now do a load that should hit the cache (no reload between).
    await assoc.loadTarget();
    expect(spy.mock.calls.length).toBe(callsAfterReload);

    spy.mockRestore();
  });

  it("disable_joins associations bypass the cache (fresh DJAS each call, Rails association.rb:107-117)", async () => {
    Associations.hasMany.call(CacheAuthor, "cachePostsDj", {
      className: "CachePost",
      through: "cachePosts",
      source: "self",
      disableJoins: true,
    });
    const author = await CacheAuthor.create({ name: "A" });
    const assoc = (author as any).association("cachePostsDj");
    expect(assoc.disableJoins).toBe(true);
    // The associationScope() returns a Promise on the disableJoins
    // path (DJAS' boxed contract). The cache field stays untouched —
    // verify that calling it twice yields two distinct Promises (fresh
    // builds), matching Rails' per-call DJAS construction.
    const a = assoc.associationScope();
    const b = assoc.associationScope();
    expect(a).not.toBe(b);
  });

  it("different owners get independent caches", async () => {
    const a1 = await CacheAuthor.create({ name: "A1" });
    const a2 = await CacheAuthor.create({ name: "A2" });
    const assoc1 = (a1 as any).association("cachePosts");
    const assoc2 = (a2 as any).association("cachePosts");
    await assoc1.loadTarget();
    await assoc2.loadTarget();
    // Cache fields are per-instance; loading one doesn't pollute the other.
    expect((assoc1 as any)._cachedAssociationScope).toBeDefined();
    expect((assoc2 as any)._cachedAssociationScope).toBeDefined();
    expect((assoc1 as any)._cachedAssociationScope).not.toBe(
      (assoc2 as any)._cachedAssociationScope,
    );
  });
});
