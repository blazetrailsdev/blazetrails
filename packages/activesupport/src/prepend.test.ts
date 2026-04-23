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

  it("preserves the original property descriptor (class methods stay non-enumerable)", () => {
    class Widget {
      spin(): string {
        return "spin";
      }
    }
    const before = Object.getOwnPropertyDescriptor(Widget.prototype, "spin");
    prepend(Widget.prototype, {
      spin(super_: Function) {
        return `wrapped-${super_.call(this)}`;
      },
    });
    const after = Object.getOwnPropertyDescriptor(Widget.prototype, "spin");
    expect(after?.enumerable).toBe(before?.enumerable);
    expect(after?.writable).toBe(before?.writable);
    expect(after?.configurable).toBe(before?.configurable);
    // Sanity: the wrapper doesn't leak into Object.keys(prototype).
    expect(Object.keys(Widget.prototype)).not.toContain("spin");
    expect(new Widget().spin()).toBe("wrapped-spin");
  });

  it("validates all target methods exist before wrapping anything (atomicity)", () => {
    class Partial {
      good(): string {
        return "ok";
      }
    }
    const originalGood = Partial.prototype.good;
    expect(() =>
      prepend(Partial.prototype, {
        good: (s: Function) => `wrapped-${s.call(undefined)}`,
        missing: (s: Function) => s,
      }),
    ).toThrow(/missing/);
    // `good` must NOT have been wrapped — atomicity guarantee.
    expect(Partial.prototype.good).toBe(originalGood);
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
