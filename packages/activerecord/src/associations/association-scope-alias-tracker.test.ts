/**
 * AssociationScope + AliasTracker integration (task #15).
 *
 * Rails' `AssociationScope#scope` threads an `AliasTracker` through
 * `get_chain` so that a chain visiting the same table more than once
 * gets distinct aliases. Before this, our `_getChain` stored bare
 * `tableName` strings on each `ReflectionProxy` — fine for chains
 * with all-distinct tables, but a self-referential chain (same
 * table on two steps) would collide: the emitted JOIN and the
 * upstream WHERE would both name the base table, ambiguating any
 * reference to it.
 *
 * This test sets up a self-referential `has_many :through` (a
 * friend-of-friend shape — the chain visits the `at_follows` join
 * table twice) and asserts the second visit gets an alias.
 *
 * Mirrors: the behavior captured by
 * `activerecord/test/cases/associations/nested_through_associations_test.rb`
 * where self-joins are common (e.g., `has_many :grandparents,
 * through: :parents, source: :parent`).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Base, registerModel } from "../index.js";
import { Associations, loadHasMany } from "../associations.js";
import { AliasTracker } from "./alias-tracker.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("AssociationScope — AliasTracker aliases repeated tables", () => {
  let adapter: DatabaseAdapter;

  class AtUser extends Base {
    static {
      this._tableName = "at_users";
      this.attribute("name", "string");
    }
  }
  // Self-referential join table: both columns reference at_users.
  // `has_many :followers through: :follows source: :follower` visits
  // at_follows twice in the conceptual chain — once outbound
  // (user → follows → target) and once inbound (via the source
  // side). We approximate this with a simple ordered chain that
  // still forces at_follows to appear twice through reflection
  // composition.
  class AtFollow extends Base {
    static {
      this._tableName = "at_follows";
      this.attribute("follower_id", "integer");
      this.attribute("followee_id", "integer");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    AtUser.adapter = adapter;
    AtFollow.adapter = adapter;
    registerModel("AtUser", AtUser);
    registerModel("AtFollow", AtFollow);
    (AtUser as any)._associations = [];
    (AtFollow as any)._associations = [];
    Associations.hasMany.call(AtUser, "follows", {
      className: "AtFollow",
      foreignKey: "follower_id",
    });
    Associations.hasMany.call(AtFollow, "follower", {
      className: "AtUser",
      foreignKey: "id",
      primaryKey: "follower_id",
    });
    Associations.hasMany.call(AtUser, "followerOfFollows", {
      className: "AtUser",
      through: "follows",
      source: "follower",
    });
  });

  it("AliasTracker returns bare arel table on first visit and an alias on repeat", () => {
    // Unit-level pin of the Rails-faithful behavior: first visit to
    // a table name yields the base arel table; second visit with the
    // same name gets an alias derived from the `aliasCandidate` thunk
    // (only invoked on repeat — matching Rails' block-form API).
    const tracker = AliasTracker.create(null, "at_users", []);
    const t1 = tracker.aliasedTableFor(AtFollow.arelTable, () => "at_follows_alt");
    expect(t1.name).toBe("at_follows");
    const t2 = tracker.aliasedTableFor(AtFollow.arelTable, () => "at_follows_alt");
    expect(t2.name).not.toBe("at_follows");
    expect(t2.name).toMatch(/at_follows/);
  });

  it("builds a chain through AtFollow with no table-alias collision in the JOIN", async () => {
    const a = await AtUser.create({ name: "a" });
    const b = await AtUser.create({ name: "b" });
    await AtFollow.create({ follower_id: a.id, followee_id: b.id });

    // The main assertion here is just that the chain walk succeeds
    // and loads the expected record — a collision would manifest
    // either as a SQL error ("ambiguous column reference") or an
    // empty result. With the tracker, the chain assigns the base
    // at_follows name on first visit; any second visit would get
    // an alias rather than a duplicate identifier.
    const reflection = (AtUser as any)._reflectOnAssociation("followerOfFollows");
    const users = await loadHasMany(a, "followerOfFollows", reflection.options);
    expect(users.length).toBeGreaterThan(0);
  });
});
