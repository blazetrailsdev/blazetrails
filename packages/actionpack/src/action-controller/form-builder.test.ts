import { describe, it, expect } from "vitest";
import { defaultFormBuilder } from "./form-builder.js";

class FakeBuilder {}
class OtherBuilder {}

describe("defaultFormBuilder DSL", () => {
  it("stores and reads a builder class on a host class", () => {
    class C {
      static defaultFormBuilder = defaultFormBuilder;
    }
    C.defaultFormBuilder(FakeBuilder);
    expect(C.defaultFormBuilder()).toBe(FakeBuilder);
  });

  it("walks the prototype chain for inherited defaults", () => {
    class Parent {
      static defaultFormBuilder = defaultFormBuilder;
    }
    class Child extends Parent {}
    Parent.defaultFormBuilder(FakeBuilder);
    expect((Child as typeof Parent).defaultFormBuilder()).toBe(FakeBuilder);
  });

  it("subclass override does not mutate parent", () => {
    class Parent {
      static defaultFormBuilder = defaultFormBuilder;
    }
    class Child extends Parent {}
    Parent.defaultFormBuilder(FakeBuilder);
    (Child as typeof Parent).defaultFormBuilder(OtherBuilder);
    expect((Child as typeof Parent).defaultFormBuilder()).toBe(OtherBuilder);
    expect(Parent.defaultFormBuilder()).toBe(FakeBuilder);
  });

  it("accepts a string name (held as-is for view-layer resolution)", () => {
    class C {
      static defaultFormBuilder = defaultFormBuilder;
    }
    C.defaultFormBuilder("MyAppFormBuilder");
    expect(C.defaultFormBuilder()).toBe("MyAppFormBuilder");
  });

  it("instance reader returns the class-level configured value", () => {
    class C {
      static defaultFormBuilder = defaultFormBuilder;
      defaultFormBuilder = defaultFormBuilder;
    }
    C.defaultFormBuilder(FakeBuilder);
    const inst = new C();
    expect(inst.defaultFormBuilder()).toBe(FakeBuilder);
  });
});
