import { describe, it, expect } from "vitest";
import { Model } from "./index.js";

/**
 * Covers the Rails-canonical names exposed by
 * activemodel/lib/active_model/dirty.rb +
 * attribute_mutation_tracker.rb: `mutations_from_database`,
 * `mutations_before_last_save`, `forget_attribute_assignments`,
 * `clear_attribute_change`.
 */
describe("DirtyMutations", () => {
  class Person extends Model {
    static {
      this.attribute("name", "string");
      this.attribute("age", "integer");
    }
  }

  it("mutationsFromDatabase tracks pending writes vs the loaded values", () => {
    const p = new Person({ name: "Alice", age: 30 });
    p.changesApplied();
    expect(p.mutationsFromDatabase).toEqual({});
    (p as any).name = "Bob";
    expect(p.mutationsFromDatabase).toEqual({ name: ["Alice", "Bob"] });
  });

  it("mutationsFromDatabase clears after changesApplied", () => {
    const p = new Person({ name: "Alice" });
    p.changesApplied();
    (p as any).name = "Bob";
    p.changesApplied();
    expect(p.mutationsFromDatabase).toEqual({});
  });

  it("mutationsBeforeLastSave snapshots pending changes at save time", () => {
    const p = new Person({ name: "Alice" });
    p.changesApplied();
    expect(p.mutationsBeforeLastSave).toEqual({});
    (p as any).name = "Bob";
    p.changesApplied();
    expect(p.mutationsBeforeLastSave).toEqual({ name: ["Alice", "Bob"] });
  });

  it("mutationsBeforeLastSave is replaced on the next save", () => {
    const p = new Person({ name: "Alice" });
    p.changesApplied();
    (p as any).name = "Bob";
    p.changesApplied();
    (p as any).name = "Carol";
    p.changesApplied();
    expect(p.mutationsBeforeLastSave).toEqual({ name: ["Bob", "Carol"] });
  });

  it("forgetAttributeAssignments drops pending tracking without reverting values", () => {
    // Matches Rails transactional rollback: the in-memory value stays, but
    // the record no longer reports it as changed.
    const p = new Person({ name: "Alice" });
    p.changesApplied();
    (p as any).name = "Bob";
    (p as any).age = 40;
    p.forgetAttributeAssignments();
    expect(p.mutationsFromDatabase).toEqual({});
    expect((p as any).name).toBe("Bob");
    expect((p as any).age).toBe(40);
  });

  it("clearAttributeChange drops a single attribute's pending change", () => {
    const p = new Person({ name: "Alice", age: 30 });
    p.changesApplied();
    (p as any).name = "Bob";
    (p as any).age = 40;
    p.clearAttributeChange("name");
    expect(p.mutationsFromDatabase).toEqual({ age: [30, 40] });
    // The value stays — only the tracking was cleared.
    expect((p as any).name).toBe("Bob");
  });
});
