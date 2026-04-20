/**
 * CollectionProxy#count emits a real COUNT query (task #16).
 *
 * Previously the non-diverged branch of CP#count called
 * `loadHasMany(...)` and returned `results.length`, instantiating
 * every associated record just to get a cardinality. For large
 * collections that's a significant perf regression. This test
 * captures emitted SQL via `Notifications.subscribe("sql.active_record")`
 * and pins the contract: on the common non-through path,
 * `proxy.count()` issues a single `SELECT COUNT(*) ...` and does
 * not load individual rows.
 *
 * Mirrors: ActiveRecord::Associations::CollectionAssociation#count
 * (associations/collection_association.rb) — loaded target returns
 * `.length`, otherwise delegates to `scope.count(...)`.
 *
 * Through-associations (nested, polymorphic, disable-joins) keep
 * the load-and-length fallback — `this.scope()` and the loader
 * paths expand the chain differently, and unifying them is out of
 * scope for this change.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Notifications } from "@blazetrails/activesupport";
import { Base, association, registerModel } from "../index.js";
import { Associations } from "../associations.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("CollectionProxy#count — non-through fast path", () => {
  let adapter: DatabaseAdapter;

  class CpcAuthor extends Base {
    static {
      this._tableName = "cpc_authors";
      this.attribute("name", "string");
    }
  }
  class CpcPost extends Base {
    static {
      this._tableName = "cpc_posts";
      this.attribute("cpc_author_id", "integer");
      this.attribute("title", "string");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    CpcAuthor.adapter = adapter;
    CpcPost.adapter = adapter;
    registerModel("CpcAuthor", CpcAuthor);
    registerModel("CpcPost", CpcPost);
    (CpcAuthor as any)._associations = [];
    (CpcPost as any)._associations = [];
    Associations.hasMany.call(CpcAuthor, "cpcPosts", {
      className: "CpcPost",
      foreignKey: "cpc_author_id",
    });
  });

  afterEach(() => Notifications.unsubscribeAll());

  it("issues a SELECT COUNT(*) and does not load individual rows", async () => {
    const author = await CpcAuthor.create({ name: "a" });
    await CpcPost.create({ cpc_author_id: author.id, title: "p1" });
    await CpcPost.create({ cpc_author_id: author.id, title: "p2" });
    await CpcPost.create({ cpc_author_id: author.id, title: "p3" });

    const observed: string[] = [];
    const sub = Notifications.subscribe("sql.active_record", (event: any) => {
      const sql = event?.payload?.sql;
      if (typeof sql === "string") observed.push(sql);
    });
    let n: number;
    try {
      n = await association(author, "cpcPosts").count();
    } finally {
      Notifications.unsubscribe(sub);
    }
    expect(n).toBe(3);
    // Exactly one SQL emitted, and it's a COUNT — not a SELECT of
    // the row data the loader would have issued. Regression guard:
    // reverting to the load-and-length path would show `SELECT *`
    // or a row-wise column list and no COUNT.
    expect(observed.length).toBe(1);
    expect(observed[0]).toMatch(/SELECT\s+COUNT\b/i);
  });
});
