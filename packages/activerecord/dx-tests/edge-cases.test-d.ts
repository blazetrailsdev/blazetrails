import { describe, it, expectTypeOf, assertType } from "vitest";
import { Base } from "@blazetrails/activerecord";

class Widget extends Base {
  declare name: string;

  static {
    this.attribute("name", "string");
  }
}

describe("edge cases — rough edges in current DX", () => {
  it("Widget.where accepts a record OR a SQL string + binds", () => {
    assertType(Widget.where({ name: "a" }));
    assertType(Widget.where("name = ?", "a"));
  });

  it("tableName is a string; primaryKey is string | string[]", () => {
    expectTypeOf(Widget.tableName).toBeString();
    expectTypeOf(Widget.primaryKey).toEqualTypeOf<string | string[]>();
  });

  it("composite primary key assignment type-checks", () => {
    class Compound extends Base {
      static {
        this.primaryKey = ["tenant_id", "id"];
      }
    }
    expectTypeOf(Compound.primaryKey).toEqualTypeOf<string | string[]>();
  });

  it("new Widget() accepts a partial attributes bag (Rails parity)", () => {
    // Rails accepts any hash — there is no compile-time filtering of unknown
    // attributes today. Flagged so we notice if the constructor tightens.
    assertType(new Widget());
    assertType(new Widget({}));
    assertType(new Widget({ name: "ok" }));
    assertType(new Widget({ totally_unknown_column: 1 }));
  });

  it("subclasses of Base are assignable to typeof Base", () => {
    const ctor: typeof Base = Widget;
    expectTypeOf(ctor).toMatchTypeOf<typeof Base>();
  });
});
