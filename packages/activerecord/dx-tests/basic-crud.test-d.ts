import { describe, it, expectTypeOf, assertType } from "vitest";
import { Base, Relation } from "@blazetrails/activerecord";

// Note: we don't redeclare `id` because Base defines it as an accessor.
class User extends Base {
  declare name: string;
  declare email: string;

  static {
    this.attribute("name", "string");
    this.attribute("email", "string");
  }
}

describe("basic CRUD DX", () => {
  it("new User() returns a User instance with typed declared attributes", () => {
    const u = new User({ name: "dean", email: "d@example.com" });
    expectTypeOf(u).toEqualTypeOf<User>();
    expectTypeOf(u.name).toBeString();
    expectTypeOf(u.email).toBeString();
    // `id` on Base is currently typed as `unknown` — DX gap.
    expectTypeOf(u.id).toBeUnknown();
  });

  it("User.all() and User.where(...) are callable statics (return `any` today)", () => {
    assertType(User.all());
    assertType(User.where({ name: "dean" }));
  });

  it("awaiting a Relation<User> resolves to User[]", async () => {
    const rel: Relation<User> = User.all() as Relation<User>;
    const rows = await rel;
    expectTypeOf(rows).toEqualTypeOf<User[]>();
  });

  it("Relation#find(id) resolves to a single User", async () => {
    const rel: Relation<User> = User.all() as Relation<User>;
    const found = await rel.find(1);
    expectTypeOf(found).toEqualTypeOf<User>();
  });

  it("Relation#find([ids]) resolves to User[]", async () => {
    const rel: Relation<User> = User.all() as Relation<User>;
    const many = await rel.find([1, 2, 3]);
    expectTypeOf(many).toEqualTypeOf<User[]>();
  });

  it("Relation#findBy returns User | null", async () => {
    const rel: Relation<User> = User.all() as Relation<User>;
    const maybe = await rel.findBy({ name: "dean" });
    expectTypeOf(maybe).toEqualTypeOf<User | null>();
  });

  it("Relation#first() returns User | null; first(n) returns User[]", async () => {
    const rel: Relation<User> = User.all() as Relation<User>;
    expectTypeOf(await rel.first()).toEqualTypeOf<User | null>();
    expectTypeOf(await rel.first(3)).toEqualTypeOf<User[]>();
  });

  it("instance persistence methods are callable", () => {
    const u = new User({ name: "dean" });
    assertType(u.save());
    assertType(u.destroy());
    assertType(u.isNewRecord());
    assertType(u.isPersisted());
  });
});
