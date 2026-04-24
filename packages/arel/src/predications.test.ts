import { describe, it, expect } from "vitest";
import { Table, Nodes, Visitors } from "./index.js";

describe("PredicationsMixin", () => {
  const users = new Table("users");

  describe("on InfixOperation (Math chain)", () => {
    it("Division#subtract chains via the Math mixin", () => {
      // arel-24: users[:age] / 3 - users[:other]
      const expr = users.get("age").divide(3).subtract(users.get("other"));
      const sql = new Visitors.ToSql().compile(expr);
      expect(sql).toBe('("users"."age" / 3 - "users"."other")');
    });

    it("BitwiseAnd#gt produces a GROUP BY / HAVING-style comparison", () => {
      // arel-25: (users[:bitmap] & 16).gt(0)
      const expr = users.get("bitmap").bitwiseAnd(16).gt(0);
      const sql = new Visitors.ToSql().compile(expr);
      expect(sql).toBe('("users"."bitmap" & 16) > 0');
    });

    it("BitwiseShiftLeft#gt chains through Predications", () => {
      // arel-28: (users[:bitmap] << 1).gt(0)
      const expr = users.get("bitmap").bitwiseShiftLeft(1).gt(0);
      const sql = new Visitors.ToSql().compile(expr);
      expect(sql).toBe('("users"."bitmap" << 1) > 0');
    });
  });

  describe("on UnaryOperation (via NodeExpression mixin)", () => {
    it("BitwiseNot#gt produces a predicate", () => {
      // arel-30: (~users[:bitmap]).gt(0)
      const expr = new Nodes.BitwiseNot(users.get("bitmap")).gt(0);
      const sql = new Visitors.ToSql().compile(expr);
      expect(sql).toBe(' ~ "users"."bitmap" > 0');
    });

    it("BitwiseNot#eq produces an equality predicate", () => {
      const expr = new Nodes.BitwiseNot(users.get("flags")).eq(0);
      const sql = new Visitors.ToSql().compile(expr);
      expect(sql).toBe(' ~ "users"."flags" = 0');
    });
  });

  describe("on NamedFunction (via Function → NodeExpression mixin)", () => {
    it("count().gt(n) produces HAVING-ready comparison", () => {
      // arel-47: photos[:id].count.gt(5)
      const expr = users.get("id").count().gt(5);
      const sql = new Visitors.ToSql().compile(expr);
      expect(sql).toBe('COUNT("users"."id") > 5');
    });

    it("NamedFunction#in accepts a value list", () => {
      const fn = new Nodes.NamedFunction("LOWER", [users.get("name")]);
      const sql = new Visitors.ToSql().compile(fn.in(["a", "b"]));
      expect(sql).toBe("LOWER(\"users\".\"name\") IN ('a', 'b')");
    });
  });
});
