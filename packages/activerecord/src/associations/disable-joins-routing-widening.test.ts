/**
 * DJAS routing gate widening (task #12).
 *
 * `_canRouteThroughViaDisableJoinsAssociationScope` in associations.ts
 * used to bail out on `options.sourceType` and on
 * `sourceReflection.isPolymorphic()` — those shapes fell back to the
 * JOIN-based AssociationScope path, defeating `disable_joins: true`.
 *
 * Rails has no such restriction: `DisableJoinsAssociationScope` walks
 * the reverseChain and evaluates `reflection.constraints()` at each
 * step. The source-type filter is already returned from
 * `ThroughReflection#constraints()` via `_sourceTypeScope()`
 * (reflection.ts#_sourceTypeScope), so the walk naturally applies
 * `WHERE source_type = 'Target'` on the through step once the gate is
 * lifted.
 *
 * These tests pin the resulting SQL shape (no JOIN) so a regression
 * that re-introduces the gate — or any future change that silently
 * falls back to AssociationScope — is caught.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Notifications } from "@blazetrails/activesupport";
import { Base, registerModel } from "../index.js";
import { Associations, loadHasMany } from "../associations.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("DJAS routing widening — sourceType + polymorphic source", () => {
  let adapter: DatabaseAdapter;

  class RwAuthor extends Base {
    static {
      this._tableName = "rw_authors";
      this.attribute("name", "string");
    }
  }
  class RwComment extends Base {
    static {
      this._tableName = "rw_comments";
      this.attribute("rw_author_id", "integer");
      this.attribute("origin_id", "integer");
      this.attribute("origin_type", "string");
    }
  }
  class RwMember extends Base {
    static {
      this._tableName = "rw_members";
      this.attribute("name", "string");
    }
  }
  class RwOtherOrigin extends Base {
    static {
      this._tableName = "rw_other_origins";
      this.attribute("label", "string");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    RwAuthor.adapter = adapter;
    RwComment.adapter = adapter;
    RwMember.adapter = adapter;
    RwOtherOrigin.adapter = adapter;
    registerModel("RwAuthor", RwAuthor);
    registerModel("RwComment", RwComment);
    registerModel("RwMember", RwMember);
    registerModel("RwOtherOrigin", RwOtherOrigin);
    (RwAuthor as any)._associations = [];
    (RwComment as any)._associations = [];

    Associations.hasMany.call(RwAuthor, "rwComments", {
      className: "RwComment",
      foreignKey: "rw_author_id",
    });
    Associations.belongsTo.call(RwComment, "origin", {
      className: "RwMember",
      foreignKey: "origin_id",
      polymorphic: true,
    });
    // has_many :no_joins_rw_members, through: :rw_comments,
    //   source: :origin, source_type: "RwMember", disable_joins: true
    // Direct (non-nested) through: RwAuthor → rwComments (through) →
    // origin (polymorphic belongsTo, sourceType disambiguates).
    Associations.hasMany.call(RwAuthor, "noJoinsRwMembers", {
      className: "RwMember",
      through: "rwComments",
      source: "origin",
      sourceType: "RwMember",
      disableJoins: true,
    });
  });

  afterEach(() => {
    Notifications.unsubscribeAll();
  });

  it("routes through DJAS (no JOIN emitted) and filters by source_type", async () => {
    const author = await RwAuthor.create({ name: "a" });
    const member = (await RwMember.create({ name: "m" })) as any;
    const other = (await RwOtherOrigin.create({ label: "o" })) as any;
    // A comment whose origin is an RwMember (matches sourceType).
    await RwComment.create({
      rw_author_id: author.id,
      origin_id: member.id,
      origin_type: "RwMember",
    });
    // A comment whose origin is RwOtherOrigin (should NOT match — the
    // source_type filter is what distinguishes the polymorphic
    // targets).
    await RwComment.create({
      rw_author_id: author.id,
      origin_id: other.id,
      origin_type: "RwOtherOrigin",
    });

    const observed: string[] = [];
    const sub = Notifications.subscribe("sql.active_record", (event: any) => {
      const sql = event?.payload?.sql;
      if (typeof sql === "string") observed.push(sql);
    });
    try {
      const reflection = (RwAuthor as any)._reflectOnAssociation("noJoinsRwMembers");
      const members = await loadHasMany(author, "noJoinsRwMembers", reflection.options);
      // Only the RwMember-originated row resolves to a real RwMember.
      expect(members.map((m: any) => m.id)).toEqual([member.id]);
    } finally {
      Notifications.unsubscribe(sub);
    }
    expect(observed.length).toBeGreaterThan(0);
    // Hard assert: no JOIN in any query — would be present if the
    // loader regressed back to AssociationScope's join-based path.
    expect(observed.some((s) => /\bJOIN\b/i.test(s))).toBe(false);
    // And the source_type filter actually lands somewhere. Rails
    // applies it on the through step (rw_comments) via
    // ThroughReflection#_sourceTypeScope.
    expect(observed.some((s) => /origin_type/i.test(s))).toBe(true);
  });
});
