import { describe, it, expect } from "vitest";
import { Table, Nodes } from "../index.js";

describe("MatchesTest", () => {
  const users = new Table("users");

  describe("escape", () => {
    it("wraps a string escape in a Quoted node (matches Rails build_quoted)", () => {
      const node = new Nodes.Matches(users.get("name"), "x%", "!");
      expect(node.escape).toBeInstanceOf(Nodes.Quoted);
      expect((node.escape as Nodes.Quoted).value).toBe("!");
    });

    it("preserves an escape that is already a Node", () => {
      const sql = new Nodes.SqlLiteral("'!'");
      const node = new Nodes.Matches(users.get("name"), "x%", sql);
      expect(node.escape).toBe(sql);
    });

    it("leaves null escape as null", () => {
      const node = new Nodes.Matches(users.get("name"), "x%");
      expect(node.escape).toBeNull();
    });
  });

  describe("DoesNotMatch", () => {
    it("inherits from Matches", () => {
      const node = new Nodes.DoesNotMatch(users.get("name"), "x%", "!");
      expect(node).toBeInstanceOf(Nodes.Matches);
      expect(node.escape).toBeInstanceOf(Nodes.Quoted);
    });
  });
});
