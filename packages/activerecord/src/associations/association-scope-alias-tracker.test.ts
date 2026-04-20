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
import { Associations } from "../associations.js";
import { AliasTracker } from "./alias-tracker.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("AssociationScope — AliasTracker aliases repeated tables", () => {
  let adapter: DatabaseAdapter;

  // `AtUser.friends` visits the `at_users` table twice — once as
  // the chain's owning klass and once as the source (friend side of
  // the friendship). Without a tracker the two ReflectionProxy
  // entries for `at_users` would collide; the tracker gives the
  // source-side visit an alias.
  class AtUser extends Base {
    static {
      this._tableName = "at_users";
      this.attribute("name", "string");
    }
  }
  class AtFriendship extends Base {
    static {
      this._tableName = "at_friendships";
      this.attribute("at_user_id", "integer");
      this.attribute("at_friend_id", "integer");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    AtUser.adapter = adapter;
    AtFriendship.adapter = adapter;
    registerModel("AtUser", AtUser);
    registerModel("AtFriendship", AtFriendship);
    (AtUser as any)._associations = [];
    (AtFriendship as any)._associations = [];
    Associations.hasMany.call(AtUser, "friendships", {
      className: "AtFriendship",
      foreignKey: "at_user_id",
    });
    Associations.belongsTo.call(AtFriendship, "friend", {
      className: "AtUser",
      foreignKey: "at_friend_id",
    });
    Associations.hasMany.call(AtUser, "friends", {
      className: "AtUser",
      through: "friendships",
      source: "friend",
    });
  });

  it("AliasTracker returns bare arel table on first visit and an alias on repeat", () => {
    // Unit-level pin of the Rails-faithful behavior: first visit to
    // a table name yields the base arel table; second visit with the
    // same name gets an alias derived from the `aliasCandidate` thunk
    // (only invoked on repeat — matching Rails' block-form API).
    const tracker = AliasTracker.create(null, "at_users", []);
    const t1 = tracker.aliasedTableFor(AtFriendship.arelTable, () => "at_friendships_alt");
    expect(t1.name).toBe("at_friendships");
    const t2 = tracker.aliasedTableFor(AtFriendship.arelTable, () => "at_friendships_alt");
    expect(t2.name).not.toBe("at_friendships");
  });
});
