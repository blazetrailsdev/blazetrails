import { describe, it, expect } from "vitest";
import { Model, lintTests, describeLint } from "./index.js";

class Post extends Model {
  static {
    this.attribute("id", "integer");
  }
}

// Self-application — exactly the Rails idiom of `include ActiveModel::Lint::Tests`
// (lint.rb), but driven through Vitest via describeLint.
describeLint({ describe, it }, () => new Post({ id: 1 }), { label: "Post lint" });

describe("Lint registry", () => {
  it("exposes the Rails-canonical test_* set", () => {
    // Mirrors lint.rb's `test_to_key`, `test_to_param`, `test_to_partial_path`,
    // `test_persisted?`, `test_model_naming`, `test_errors_aref`, `test_errors`.
    expect(lintTests.map((t) => t.name).sort()).toEqual(
      [
        "errors",
        "errors_aref",
        "model_naming",
        "persisted?",
        "to_key",
        "to_param",
        "to_partial_path",
      ].sort(),
    );
  });

  it("each registered test runs against a compliant model", () => {
    const model = new Post({ id: 1 });
    for (const t of lintTests) {
      expect(() => t.run(model)).not.toThrow();
    }
  });

  it("flags non-compliant models with a clear error", () => {
    const broken = {
      toKey: () => "not an array",
      isPersisted: () => true,
    };
    expect(() => lintTests.find((t) => t.name === "to_key")!.run(broken)).toThrow(
      /toKey must return null or an array/,
    );
  });
});
