/**
 * Regression for task #25: `SELECT *` projects all joined tables'
 * columns, and most drivers (better-sqlite3, pg's default mapper)
 * collapse same-named columns into a single key per row — last
 * write wins. For a `has_many :through source: belongsTo` like
 * `User.friends through: friendships source: friend`, the join's
 * target is the same `users` table, but `friendships` also has its
 * own `id` column. Without an explicit projection, `friendships.id`
 * silently overwrites `users.id` in the row hash, and the hydrated
 * record carries the friendship's id with the friend's other
 * columns.
 *
 * Fix: default projection becomes `<target>.*` when joins are
 * present (mirrors Rails' `klass.arel_table[Arel.star]`).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Base, registerModel } from "../index.js";
import { Associations, loadHasMany } from "../associations.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("SELECT * column collision in joined relations", () => {
  let adapter: DatabaseAdapter;

  class SsjUser extends Base {
    static {
      this._tableName = "ssj_users";
      this.attribute("name", "string");
    }
  }
  class SsjFriendship extends Base {
    static {
      this._tableName = "ssj_friendships";
      this.attribute("ssj_user_id", "integer");
      this.attribute("ssj_friend_id", "integer");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    SsjUser.adapter = adapter;
    SsjFriendship.adapter = adapter;
    registerModel("SsjUser", SsjUser);
    registerModel("SsjFriendship", SsjFriendship);
    (SsjUser as any)._associations = [];
    (SsjUser as any)._reflections = {};
    (SsjFriendship as any)._associations = [];
    (SsjFriendship as any)._reflections = {};

    Associations.hasMany.call(SsjUser, "friendships", {
      className: "SsjFriendship",
      foreignKey: "ssj_user_id",
    });
    Associations.belongsTo.call(SsjFriendship, "friend", {
      className: "SsjUser",
      foreignKey: "ssj_friend_id",
    });
    Associations.hasMany.call(SsjUser, "friends", {
      className: "SsjUser",
      through: "friendships",
      source: "friend",
    });
  });

  it("hydrates the target's columns, not the join table's, when ids collide", async () => {
    const a = await SsjUser.create({ name: "a" });
    const b = await SsjUser.create({ name: "b" });
    // Friendship id will land at 1 (first row in ssj_friendships),
    // shadowing users.id=1 (alice) if the projection is `*` — the
    // result row's `id` key would be the friendship's id, not the
    // friend's. The friend we expect (b) has user.id=2.
    await SsjFriendship.create({ ssj_user_id: a.id, ssj_friend_id: b.id });

    const reflection = (SsjUser as any)._reflectOnAssociation("friends");
    const friends = await loadHasMany(a, "friends", reflection.options);
    expect(friends.map((u: any) => ({ id: u.id, name: u.name }))).toEqual([
      { id: b.id, name: "b" },
    ]);
  });

  it("emitted SQL projects the target table's `<target>.*`", async () => {
    const reflection = (SsjUser as any)._reflectOnAssociation("friends");
    const rel = (SsjUser as any).all().joins("INNER JOIN ssj_friendships ON 1 = 1");
    const sql = rel.toSql();
    expect(sql).toMatch(/SELECT\s+"ssj_users"\.\*/i);
    expect(reflection).toBeTruthy();
  });
});
