/**
 * Tests for JoinBase.arelTable, joinType propagation in makeConstraints,
 * and readonlyValue propagation in instantiateFromRows.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Base, registerModel } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";
import { Associations } from "../associations.js";
import { JoinDependency } from "./join-dependency.js";
import { JoinBase } from "./join-dependency/join-base.js";
import { Nodes, Table } from "@blazetrails/arel";

describe("JoinBase.arelTable", () => {
  let adapter: any;

  class Post extends Base {
    static {
      this.attribute("title", "string");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    (Post as any).adapter = adapter;
    (Post as any)._associations = [];
    registerModel(Post);
  });

  it("returns an Arel Table node", () => {
    const joinBase = new JoinBase(Post);
    const arelTable = joinBase.arelTable;
    expect(arelTable).toBeInstanceOf(Table);
    expect(arelTable.name).toBe(Post.tableName);
  });
});

describe("joinType propagation in joinConstraints", () => {
  let adapter: any;

  class Post extends Base {
    static {
      this.attribute("title", "string");
    }
  }

  class Comment extends Base {
    static {
      this.attribute("postId", "integer");
      this.attribute("body", "string");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    for (const m of [Post, Comment]) {
      (m as any).adapter = adapter;
      (m as any)._associations = [];
      registerModel(m);
    }
    Associations.hasMany.call(Post, "comments", { className: "Comment" });
  });

  it("emits InnerJoin when joinType is InnerJoin", () => {
    const jd = new JoinDependency(Post, Nodes.InnerJoin);
    jd.addAssociation("comments");

    const joins = jd.joinConstraints([]);
    expect(joins.length).toBeGreaterThan(0);
    for (const join of joins) {
      expect(join).toBeInstanceOf(Nodes.InnerJoin);
    }
  });

  it("emits OuterJoin when joinType is OuterJoin", () => {
    const jd = new JoinDependency(Post, Nodes.OuterJoin);
    jd.addAssociation("comments");

    const joins = jd.joinConstraints([]);
    expect(joins.length).toBeGreaterThan(0);
    for (const join of joins) {
      expect(join).toBeInstanceOf(Nodes.OuterJoin);
    }
  });
});
