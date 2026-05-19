import { describe, it, expect } from "vitest";
import { Base } from "./base.js";
import { Options as ParamsWrapperOptions } from "./metal/params-wrapper.js";

describe("Base ParamsWrapper wiring", () => {
  it("has default _wrapperOptions with empty format array", () => {
    expect(Base._wrapperOptions).toBeInstanceOf(ParamsWrapperOptions);
    expect(Base._wrapperOptions.format).toEqual([]);
  });

  it("wrapParameters with symbol/string sets name and binds klass", () => {
    class UsersController extends Base {}
    UsersController.wrapParameters("person", { include: ["name"] });
    expect(UsersController._wrapperOptions.name).toBe("person");
    expect(UsersController._wrapperOptions.include).toEqual(["name"]);
    expect(UsersController._wrapperOptions.klass).toBe(UsersController);
    // Parent unchanged
    expect(Base._wrapperOptions.name).toBeNull();
  });

  it("wrapParameters with hash merges format from current", () => {
    class A extends Base {}
    A.wrapParameters({ format: ["json"] });
    class B extends A {}
    // No own format set yet; inherits A's [json]
    expect(B._wrapperOptions.format).toEqual(["json"]);
    // Adding more options preserves format from current
    B.wrapParameters({ include: ["x"] });
    expect(B._wrapperOptions.format).toEqual(["json"]);
    expect(B._wrapperOptions.include).toEqual(["x"]);
  });

  it("wrapParameters(false) disables wrapping by zeroing format", () => {
    class C extends Base {}
    C.wrapParameters({ format: ["json"] });
    C.wrapParameters(false);
    expect(C._wrapperOptions.format).toEqual([]);
  });

  it("wrapParameters with class arg stores model", () => {
    class Model {}
    class D extends Base {}
    D.wrapParameters(Model);
    expect(D._wrapperOptions.model).toBe(Model);
    expect(D._wrapperOptions.klass).toBe(D);
  });

  it("inheritedParamsWrapper rebinds klass when format is enabled", () => {
    class Parent extends Base {}
    Parent.wrapParameters({ format: ["json"], name: "parent" });
    class Child extends Parent {}
    Child.inheritedParamsWrapper();
    expect(Child._wrapperOptions.klass).toBe(Child);
    expect(Child._wrapperOptions.name).toBe("parent");
    expect(Child._wrapperOptions.format).toEqual(["json"]);
    // Parent's options unchanged
    expect(Parent._wrapperOptions.klass).toBe(Parent);
  });

  it("inheritedParamsWrapper is a no-op when format is empty", () => {
    class E extends Base {}
    const before = E._wrapperOptions;
    E.inheritedParamsWrapper();
    expect(E._wrapperOptions).toBe(before);
  });

  it("instance _wrapperOptions reads from constructor", () => {
    class F extends Base {}
    F.wrapParameters("widget");
    const instance = Object.create(F.prototype) as F;
    expect(instance._wrapperOptions.name).toBe("widget");
  });
});
