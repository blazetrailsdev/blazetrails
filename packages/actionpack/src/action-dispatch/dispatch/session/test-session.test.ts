import { describe, expect, it } from "vitest";
import { TestSession } from "../../../action-controller/test-case.js";

// ==========================================================================
// dispatch/session/test_session_test.rb  (ActionController::TestSessionTest)
//
// Rails design: ActionController::TestSession is an in-memory session store
// backed by a plain hash. Keys are always coerced to strings. `id` returns a
// session-ID value object whose `public_id` is the hex string; the special
// key "session_id" returns that same value via `[]`. `fetch` follows Ruby's
// Hash#fetch contract: block wins over default when both are given.
// ==========================================================================

describe("ActionController::TestSessionTest", () => {
  it("test_initialize_with_values", () => {
    const session = new TestSession({ one: "one", two: "two" });
    expect(session.get("one")).toBe("one");
    expect(session.get("two")).toBe("two");
  });

  it("test_setting_session_item_sets_item", () => {
    const session = new TestSession();
    session.set("key", "value");
    expect(session.get("key")).toBe("value");
  });

  it("test_calling_delete_removes_item_and_returns_its_value", () => {
    const session = new TestSession();
    session.set("key", "value");
    expect(session.get("key")).toBe("value");
    expect(session.delete("key")).toBe("value");
    expect(session.get("key")).toBeUndefined();
  });

  it("test_calling_update_with_params_passes_to_attributes", () => {
    const session = new TestSession();
    session.update({ key: "value" });
    expect(session.get("key")).toBe("value");
  });

  it("test_clear_empties_session", () => {
    const session = new TestSession({ one: "one", two: "two" });
    session.clear();
    expect(session.get("one")).toBeUndefined();
    expect(session.get("two")).toBeUndefined();
  });

  it("test_keys_and_values", () => {
    const session = new TestSession({ one: "1", two: "2" });
    expect(session.keys()).toEqual(["one", "two"]);
    expect(session.values()).toEqual(["1", "2"]);
  });

  it("test_dig", () => {
    const session = new TestSession({ one: { two: { three: "3" } } });
    expect(session.dig("one", "two", "three")).toBe("3");
    expect(session.dig("ruby", "on", "rails")).toBeUndefined();
  });

  it("test_fetch_returns_default", () => {
    const session = new TestSession({ one: "1" });
    expect(session.fetch("two", "2")).toBe("2");
  });

  it("test_fetch_on_symbol_returns_value", () => {
    const session = new TestSession({ one: "1" });
    expect(session.fetch("one")).toBe("1");
  });

  it("test_fetch_on_string_returns_value", () => {
    const session = new TestSession({ one: "1" });
    expect(session.fetch("one")).toBe("1");
  });

  it("test_fetch_returns_block_value", () => {
    const session = new TestSession({ one: "1" });
    expect(session.fetch("2", (key: string) => parseInt(key, 10))).toBe(2);
  });

  it("test_session_id", () => {
    const session = new TestSession();
    expect(typeof session.id.publicId).toBe("string");
    expect(session.id.publicId).toBe(session.get("session_id"));
  });

  it("test_merge!", () => {
    const session = new TestSession();
    session.mergeBang({ key: "value" });
    expect(session.get("key")).toBe("value");
  });
});
