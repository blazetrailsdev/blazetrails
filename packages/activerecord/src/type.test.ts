import { describe, it, expect } from "vitest";
import { register, lookup, registry, AdapterSpecificRegistry } from "./type.js";
import { Type } from "@blazetrails/activemodel";

class ArgType extends Type<unknown> {
  readonly name = "arg_type";
  readonly args: unknown;
  constructor(args?: unknown) {
    super();
    this.args = args;
  }
  cast(value: unknown) {
    return value;
  }
  override type() {
    return "arg_type";
  }
}

class PgArgType extends ArgType {
  override type() {
    return "pg_arg_type";
  }
}

describe("TypeTest", () => {
  it("registering a new type", () => {
    register("__type_test_register__", ArgType);
    expect(lookup("__type_test_register__")).toBeInstanceOf(ArgType);
  });

  it("looking up a type for a specific adapter", () => {
    register("__type_test_adapter__", ArgType, { override: false });
    register("__type_test_adapter__", PgArgType, { adapter: "postgresql" });

    expect(lookup("__type_test_adapter__", { adapter: "sqlite3" })).toBeInstanceOf(ArgType);
    expect(lookup("__type_test_adapter__", { adapter: "postgresql" })).toBeInstanceOf(PgArgType);
  });

  it("lookup defaults to the current adapter", () => {
    register("__type_test_default__", ArgType, { override: false });
    register("__type_test_default__", PgArgType, { adapter: "sqlite" });

    // registry() returns the shared AdapterSpecificRegistry
    expect(registry()).toBeInstanceOf(AdapterSpecificRegistry);
    expect(lookup("__type_test_default__")).toBeInstanceOf(PgArgType);
  });
});
