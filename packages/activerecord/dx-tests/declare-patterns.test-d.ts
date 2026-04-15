/**
 * DX: the `declare` patterns for typing runtime-attached members.
 *
 * Several things in ActiveRecord are attached to a class/instance at runtime
 * (via `this.attribute`, `this.hasMany`, `this.scope`, `this.enum`, ...)
 * and so aren't visible to the TypeScript type system by default. Use a
 * `declare` field on the class body to pin the static type. This file is
 * the canonical reference for every supported pattern.
 */

import { describe, it, expectTypeOf } from "vitest";
import { Base, CollectionProxy, Relation } from "@blazetrails/activerecord";

// --- Attribute typing: `this.attribute("name", "string")` + `declare name: string` ---
// (Don't redeclare `id` — Base defines it as an accessor; narrow at the use
// site with `user.id as number` instead.)
class User extends Base {
  declare name: string;
  declare email: string;
  declare admin: boolean;

  static {
    this.attribute("name", "string");
    this.attribute("email", "string");
    this.attribute("admin", "boolean", { default: false });
  }
}

// --- Association typing ---

class Comment extends Base {
  declare body: string;
  declare post_id: number;

  static {
    this.attribute("body", "string");
    this.attribute("post_id", "integer");
    this.belongsTo("post");
  }
}

class Tag extends Base {
  declare name: string;
  static {
    this.attribute("name", "string");
  }
}

class Author extends Base {
  declare name: string;

  // hasMany → CollectionProxy<Comment>
  declare comments: CollectionProxy<Comment>;

  // hasAndBelongsToMany → CollectionProxy<Tag> (same shape as hasMany)
  declare tags: CollectionProxy<Tag>;

  // hasOne → Profile | null (synchronous reader; returns the record directly)
  declare profile: Profile | null;

  static {
    this.attribute("name", "string");
    this.hasMany("comments");
    this.hasAndBelongsToMany("tags");
    this.hasOne("profile");
  }
}

class Profile extends Base {
  declare bio: string;
  declare author_id: number;

  // belongsTo → Author | null (synchronous reader)
  declare author: Author | null;

  static {
    this.attribute("bio", "string");
    this.attribute("author_id", "integer");
    this.belongsTo("author");
  }
}

// --- Named scope typing: `this.scope("published", fn)` + `declare static published: ...` ---
class Post extends Base {
  declare title: string;
  declare published: boolean;

  // Class-level scope returns the scoped Relation.
  declare static published: () => Relation<Post>;
  declare static recent: (sinceDays: number) => Relation<Post>;

  static {
    this.attribute("title", "string");
    this.attribute("published", "boolean");
    this.scope("published", (rel: Relation<Post>) => rel.where({ published: true }));
    this.scope("recent", (rel: Relation<Post>, sinceDays: number) => {
      void sinceDays;
      return rel.where({});
    });
  }
}

// --- Enum typing: `this.enum("status", {...})` generates predicate/setter/scope trio ---
class Task extends Base {
  declare status: string;

  // record.isLow() / record.isHigh() — boolean predicates
  declare isLow: () => boolean;
  declare isHigh: () => boolean;
  // record.low() / record.high() — in-memory setters
  declare low: () => void;
  declare high: () => void;
  // record.lowBang() / record.highBang() — persisting setters
  declare lowBang: () => Promise<void>;
  declare highBang: () => Promise<void>;
  // Class-level enum scopes: Task.low() / Task.high() / Task.notLow() / Task.notHigh()
  declare static low: () => Relation<Task>;
  declare static high: () => Relation<Task>;
  declare static notLow: () => Relation<Task>;
  declare static notHigh: () => Relation<Task>;

  static {
    this.attribute("status", "integer");
    this.enum("status", { low: 0, high: 1 });
  }
}

describe("declare patterns — typing runtime-attached members", () => {
  it("attributes: `declare name: string` exposes the typed field", () => {
    const u = new User({ name: "dean", email: "d@example.com", admin: false });
    expectTypeOf(u.name).toBeString();
    expectTypeOf(u.email).toBeString();
    expectTypeOf(u.admin).toBeBoolean();
  });

  it("hasMany accessor: `declare comments: CollectionProxy<Comment>`", async () => {
    const author = new Author({ name: "dean" });
    expectTypeOf(author.comments).toMatchTypeOf<CollectionProxy<Comment>>();
    expectTypeOf(await author.comments.first()).toEqualTypeOf<Comment | null>();
  });

  it("hasAndBelongsToMany accessor: `declare tags: CollectionProxy<Tag>` (same shape)", async () => {
    const author = new Author({ name: "dean" });
    expectTypeOf(author.tags).toMatchTypeOf<CollectionProxy<Tag>>();
    expectTypeOf(await author.tags.first()).toEqualTypeOf<Tag | null>();
  });

  it("belongsTo accessor: `declare author: Author | null` (synchronous reader)", () => {
    const profile = new Profile({ bio: "hi", author_id: 1 });
    expectTypeOf(profile.author).toEqualTypeOf<Author | null>();
  });

  it("hasOne accessor: `declare profile: Profile | null`", () => {
    const author = new Author({ name: "dean" });
    expectTypeOf(author.profile).toEqualTypeOf<Profile | null>();
  });

  it("named scope (static): `declare static published: () => Relation<Post>`", () => {
    expectTypeOf(Post.published).toEqualTypeOf<() => Relation<Post>>();
    expectTypeOf(Post.published()).toMatchTypeOf<Relation<Post>>();
    expectTypeOf(Post.recent).toEqualTypeOf<(sinceDays: number) => Relation<Post>>();
  });

  it("enum predicate: `declare isLow: () => boolean`", () => {
    const t = new Task({ status: 0 });
    expectTypeOf(t.isLow).toEqualTypeOf<() => boolean>();
    expectTypeOf(t.isLow()).toBeBoolean();
  });

  it("enum setter (in-memory): `declare low: () => void`", () => {
    const t = new Task({ status: 0 });
    expectTypeOf(t.low).toEqualTypeOf<() => void>();
  });

  it("enum setter (persisting): `declare lowBang: () => Promise<void>`", () => {
    const t = new Task({ status: 0 });
    expectTypeOf(t.lowBang).toEqualTypeOf<() => Promise<void>>();
  });

  it("enum class scopes: `declare static low: () => Relation<Task>`", () => {
    expectTypeOf(Task.low).toEqualTypeOf<() => Relation<Task>>();
    expectTypeOf(Task.notHigh()).toMatchTypeOf<Relation<Task>>();
  });

  it("without a declare, runtime members fall through to `unknown`", () => {
    class Plain extends Base {
      static {
        this.attribute("name", "string");
        this.hasMany("posts");
        this.scope("active", (rel: Relation<Plain>) => rel);
      }
    }
    const p = new Plain({ name: "x" });
    expectTypeOf(p.name).toBeUnknown();
    expectTypeOf(p.posts).toBeUnknown();
    expectTypeOf((Plain as typeof Plain & { active: unknown }).active).toBeUnknown();
  });
});
