import { describe, it, expect, beforeEach } from "vitest";
import { Base, registerModel } from "../index.js";
import { Associations } from "../associations.js";
import { AssociationScope, ReflectionProxy } from "./association-scope.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("AssociationScope", () => {
  let adapter: DatabaseAdapter;

  beforeEach(() => {
    adapter = createTestAdapter();
  });

  function makeModels() {
    class AsAuthor extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class AsPost extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("as_author_id", "integer");
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    registerModel(AsAuthor);
    registerModel(AsPost);
    Associations.hasMany.call(AsAuthor, "as_posts", {
      className: "AsPost",
      foreignKey: "as_author_id",
    });
    Associations.belongsTo.call(AsPost, "as_author", {
      className: "AsAuthor",
      foreignKey: "as_author_id",
    });
    return { AsAuthor, AsPost };
  }

  it("INSTANCE is a shared identity-transformation instance", () => {
    expect(AssociationScope.INSTANCE).toBeInstanceOf(AssociationScope);
    // static scope() delegates to INSTANCE.scope()
    expect(typeof AssociationScope.scope).toBe("function");
  });

  it("create(valueTransformation) accepts a custom transformer", () => {
    const upcased = AssociationScope.create((v: unknown) =>
      typeof v === "string" ? v.toUpperCase() : v,
    );
    expect(upcased).toBeInstanceOf(AssociationScope);
    // Instance-level scope is exposed; static reuses INSTANCE.
    expect(typeof upcased.scope).toBe("function");
  });

  it("builds a hasMany scope with WHERE on the target's FK = owner.PK", async () => {
    const { AsAuthor } = makeModels();
    const author = new AsAuthor({ id: 7, name: "Alice" });
    const reflection = (AsAuthor as any)._reflectOnAssociation("as_posts");
    expect(reflection).toBeDefined();

    const scope: any = AssociationScope.scope({
      owner: author,
      reflection,
      klass: reflection.klass,
    });

    const sql = scope.toSql();
    expect(sql).toMatch(/"as_posts".*"as_author_id"\s*=\s*7/s);
  });

  it("builds a belongsTo scope with WHERE on the target's PK = owner.FK + limit(1)", async () => {
    const { AsAuthor, AsPost } = makeModels();
    const post = new AsPost({ id: 1, as_author_id: 42, title: "x" });
    const reflection = (AsPost as any)._reflectOnAssociation("as_author");
    expect(reflection).toBeDefined();
    expect(reflection.klass).toBe(AsAuthor);

    const scope: any = AssociationScope.scope({
      owner: post,
      reflection,
      klass: reflection.klass,
    });

    const sql = scope.toSql();
    // belongsTo → WHERE target.id = owner.fk; isCollection? false → LIMIT 1.
    expect(sql).toMatch(/"as_authors".*"id"\s*=\s*42.*LIMIT\s+1/s);
  });

  it("getBindValues collects owner's join_foreign_key values (chain length 1)", () => {
    const { AsAuthor } = makeModels();
    const author = new AsAuthor({ id: 99, name: "Bob" });
    const reflection = (AsAuthor as any)._reflectOnAssociation("as_posts");

    const binds = AssociationScope.getBindValues(author, [reflection]);
    // hasMany: joinForeignKey = owner PK ("id"). Owner id = 99.
    expect(binds).toEqual([99]);
  });

  it("ReflectionProxy delegates joinPrimaryKey / joinForeignKey / klass to the reflection", () => {
    const { AsAuthor, AsPost } = makeModels();
    const reflection = (AsAuthor as any)._reflectOnAssociation("as_posts");
    const proxy = new ReflectionProxy(reflection, /* aliasedTable */ null);

    expect(proxy.joinPrimaryKey).toBe(reflection.joinPrimaryKey);
    expect(proxy.joinForeignKey).toBe(reflection.joinForeignKey);
    expect(proxy.klass).toBe(AsPost);
    // Rails' all_includes; block returns nil → we return null.
    expect(proxy.allIncludes()).toBeNull();
  });

  it("scope() raises for through chains (PR 1 limitation)", () => {
    class ThroughAuthor extends Base {
      static {
        this.attribute("id", "integer");
        this.adapter = adapter;
      }
    }
    class ThroughMembership extends Base {
      static {
        this.attribute("through_author_id", "integer");
        this.attribute("through_post_id", "integer");
        this.adapter = adapter;
      }
    }
    class ThroughPost extends Base {
      static {
        this.attribute("id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel(ThroughAuthor);
    registerModel(ThroughMembership);
    registerModel(ThroughPost);
    Associations.hasMany.call(ThroughAuthor, "through_memberships", {
      className: "ThroughMembership",
      foreignKey: "through_author_id",
    });
    Associations.hasMany.call(ThroughAuthor, "through_posts", {
      className: "ThroughPost",
      through: "through_memberships",
    });
    Associations.belongsTo.call(ThroughMembership, "through_post", {
      className: "ThroughPost",
      foreignKey: "through_post_id",
    });

    const author = new ThroughAuthor({ id: 1 });
    const reflection = (ThroughAuthor as any)._reflectOnAssociation("through_posts");
    expect(() =>
      AssociationScope.scope({
        owner: author,
        reflection,
        klass: reflection.klass,
      }),
    ).toThrow(/multi-step chain/);
  });
});
