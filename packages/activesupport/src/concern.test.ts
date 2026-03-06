import { describe, it, expect, vi } from "vitest";
import { concern, includeConcern, hasConcern } from "./concern.js";

describe("Concern", () => {
  it("mixes instance methods into class prototype", () => {
    const Greetable = concern({
      instanceMethods: {
        greet() {
          return "hello";
        },
      },
    });

    class User {}
    includeConcern(User, Greetable);

    const user = new User() as any;
    expect(user.greet()).toBe("hello");
  });

  it("mixes class methods as static methods", () => {
    const Findable = concern({
      classMethods: {
        findByName(name: string) {
          return `found:${name}`;
        },
      },
    });

    class User {}
    includeConcern(User, Findable);

    expect((User as any).findByName("dean")).toBe("found:dean");
  });

  it("runs included block", () => {
    const fn = vi.fn();
    const Trackable = concern({ included: fn });

    class User {}
    includeConcern(User, Trackable);

    expect(fn).toHaveBeenCalledWith(User);
  });

  it("resolves dependencies", () => {
    const order: string[] = [];

    const Base = concern({
      included: () => order.push("base"),
      instanceMethods: {
        base() {
          return true;
        },
      },
    });

    const Extended = concern({
      dependencies: [Base],
      included: () => order.push("extended"),
      instanceMethods: {
        extended() {
          return true;
        },
      },
    });

    class User {}
    includeConcern(User, Extended);

    expect(order).toEqual(["base", "extended"]);
    const user = new User() as any;
    expect(user.base()).toBe(true);
    expect(user.extended()).toBe(true);
  });

  it("does not include the same concern twice", () => {
    const fn = vi.fn();
    const Trackable = concern({ included: fn });

    class User {}
    includeConcern(User, Trackable);
    includeConcern(User, Trackable);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("hasConcern returns correct value", () => {
    const Trackable = concern({ instanceMethods: {} });

    class User {}
    expect(hasConcern(User, Trackable)).toBe(false);

    includeConcern(User, Trackable);
    expect(hasConcern(User, Trackable)).toBe(true);
  });

  it("dependencies are only included once even if multiple concerns depend on them", () => {
    const fn = vi.fn();
    const Base = concern({ included: fn });
    const A = concern({ dependencies: [Base] });
    const B = concern({ dependencies: [Base] });

    class User {}
    includeConcern(User, A);
    includeConcern(User, B);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
