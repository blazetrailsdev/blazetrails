import { describe, it, expectTypeOf, assertType } from "vitest";
import { Base, Relation } from "@blazetrails/activerecord";

class Post extends Base {
  declare title: string;
  declare published: boolean;

  static {
    this.attribute("title", "string");
    this.attribute("published", "boolean");
  }
}

describe("query chaining DX", () => {
  it("a Relation<Post> is awaitable and resolves to Post[]", async () => {
    const rel = {} as Relation<Post>;
    const rows = await rel;
    expectTypeOf(rows).toEqualTypeOf<Post[]>();
  });

  it("Relation exposes then/catch/finally (PromiseLike surface)", () => {
    const rel = {} as Relation<Post>;
    assertType<Relation<Post>["then"]>(rel.then);
    assertType<Relation<Post>["catch"]>(rel.catch);
    assertType<Relation<Post>["finally"]>(rel.finally);
  });

  it("finder methods on Relation keep the generic T", async () => {
    const rel = {} as Relation<Post>;
    expectTypeOf(await rel.first()).toEqualTypeOf<Post | null>();
    expectTypeOf(await rel.firstBang()).toEqualTypeOf<Post>();
    expectTypeOf(await rel.last()).toEqualTypeOf<Post | null>();
    expectTypeOf(await rel.sole()).toEqualTypeOf<Post>();
    expectTypeOf(await rel.take(5)).toEqualTypeOf<Post[]>();
  });

  it("Post.where returns `any` today — known DX gap", () => {
    // A future improvement would return Relation<Post> so chaining keeps typing.
    const chain = Post.where({ published: true });
    expectTypeOf(chain).toBeAny();
  });

  it("hand-typed chain via `as Relation<Post>` preserves T through await", async () => {
    const rel = Post.where({ published: true }) as Relation<Post>;
    const rows = await rel;
    expectTypeOf(rows).toEqualTypeOf<Post[]>();
  });
});
