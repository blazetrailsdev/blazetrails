import { describe, it, expect } from "vitest";
import { prepend } from "./prepend.js";

describe("prepend", () => {
  it("wraps a single method and exposes super_ as the first argument", () => {
    class Relation {
      where(n: number): string {
        return `original:${n}`;
      }
    }
    prepend(Relation.prototype, {
      where(super_: Function, n: number) {
        return `wrapped(${super_.call(this, n * 2)})`;
      },
    });
    expect(new Relation().where(3)).toBe("wrapped(original:6)");
  });

  it("preserves `this` binding to the caller instance", () => {
    class Box {
      _tag = "self";
      identify(): string {
        return this._tag;
      }
    }
    prepend(Box.prototype, {
      identify(super_: Function) {
        return `outer:${super_.call(this)}`;
      },
    });
    const b = new Box();
    b._tag = "custom";
    expect(b.identify()).toBe("outer:custom");
  });

  it("lets the module short-circuit without calling super_", () => {
    class Toggle {
      value(): number {
        throw new Error("original should be skipped");
      }
    }
    prepend(Toggle.prototype, {
      value(_super_: Function) {
        return 42;
      },
    });
    expect(new Toggle().value()).toBe(42);
  });

  it("throws when wrapping a method that doesn't exist on the target", () => {
    class Empty {}
    expect(() => prepend(Empty.prototype, { ghost: (s: Function) => s })).toThrow(
      /no method with that name/,
    );
  });

  it("throws when the target isn't an object or function", () => {
    expect(() => prepend(null as unknown as object, {})).toThrow(TypeError);
    expect(() => prepend(42 as unknown as object, {})).toThrow(TypeError);
  });

  it("works on static/class members when the target is the class itself", () => {
    class Factory {
      static make(x: number): number {
        return x;
      }
    }
    prepend(Factory as unknown as Record<string, unknown>, {
      make(super_: Function, x: number) {
        return (super_.call(this, x) as number) + 1;
      },
    });
    expect(Factory.make(10)).toBe(11);
  });

  it("second prepend on the same method chains on top of the first", () => {
    class Greeter {
      hi(): string {
        return "base";
      }
    }
    prepend(Greeter.prototype, {
      hi(super_: Function) {
        return `a-${super_.call(this)}`;
      },
    });
    prepend(Greeter.prototype, {
      hi(super_: Function) {
        return `b-${super_.call(this)}`;
      },
    });
    expect(new Greeter().hi()).toBe("b-a-base");
  });
});
