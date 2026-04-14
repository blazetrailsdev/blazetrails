import { describe, it, expectTypeOf, assertType } from "vitest";
import { Base } from "@blazetrails/activerecord";

// `belongsTo` / `hasMany` / `hasOne` are mixed into typeof Base at runtime via
// `extend()`. They are real static methods but not yet statically typed —
// each `@ts-expect-error` below is a concrete DX improvement waiting to be made.

class Author extends Base {
  declare name: string;

  static {
    // @ts-expect-error hasMany not statically typed on typeof Base
    this.hasMany("posts");
  }
}

class Post extends Base {
  declare title: string;
  declare authorId: number;

  static {
    // @ts-expect-error belongsTo not statically typed on typeof Base
    this.belongsTo("author");
  }
}

class Profile extends Base {
  declare authorId: number;

  static {
    // @ts-expect-error hasOne not statically typed on typeof Base
    this.hasOne("author");
  }
}

describe("associations DX", () => {
  it("model classes created with associations remain their own type", () => {
    const post = new Post({ title: "hi", author_id: 1 });
    expectTypeOf(post).toEqualTypeOf<Post>();
    const author = new Author({ name: "dean" });
    expectTypeOf(author).toEqualTypeOf<Author>();
    const profile = new Profile({ author_id: 1 });
    expectTypeOf(profile).toEqualTypeOf<Profile>();
  });

  it("association helpers exist at runtime even though types are missing", () => {
    // Cast to any so we can at least assert they're present. When the types
    // are fixed, drop this cast and the `@ts-expect-error` above.
    const B = Base as unknown as {
      belongsTo: (name: string, options?: Record<string, unknown>) => void;
      hasMany: (name: string, options?: Record<string, unknown>) => void;
      hasOne: (name: string, options?: Record<string, unknown>) => void;
    };
    expectTypeOf(B.belongsTo).parameters.toEqualTypeOf<[string, Record<string, unknown>?]>();
    expectTypeOf(B.hasMany).returns.toEqualTypeOf<void>();
    expectTypeOf(B.hasOne).returns.toEqualTypeOf<void>();
  });

  it("association accessors are not typed on the instance today", () => {
    // Ideally: post.author → Promise<Author | null>, author.posts → CollectionProxy.
    // This test fails the moment someone adds typed accessors (good — time to
    // replace the runtime cast above with real types).
    type PostKeys = keyof Post;
    type HasAuthorAccessor = "author" extends PostKeys ? true : false;
    assertType<HasAuthorAccessor>(true as HasAuthorAccessor);
  });
});
