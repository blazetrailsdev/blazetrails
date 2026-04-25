import { describe, it, expect } from "vitest";
import { Model } from "./index.js";

describe("ActiveModel", () => {
  // =========================================================================
  // Phase 1000/1050 — Attributes and Type Casting
  // =========================================================================
  describe("Attributes", () => {
    class User extends Model {
      static {
        this.attribute("name", "string");
        this.attribute("age", "integer", { default: 0 });
        this.attribute("score", "float");
        this.attribute("active", "boolean", { default: true });
      }
    }

    it("initializes with defaults", () => {
      const u = new User();
      expect(u.readAttribute("name")).toBe(null);
      expect(u.readAttribute("age")).toBe(0);
      expect(u.readAttribute("active")).toBe(true);
    });

    it("initializes with provided values", () => {
      const u = new User({ name: "dean", age: 30 });
      expect(u.readAttribute("name")).toBe("dean");
      expect(u.readAttribute("age")).toBe(30);
    });

    it("casts string to integer", () => {
      const u = new User({ age: "25" });
      expect(u.readAttribute("age")).toBe(25);
    });

    it("integer truncates floats", () => {
      const u = new User({ age: 25.9 });
      expect(u.readAttribute("age")).toBe(25);
    });

    it("casts string to float", () => {
      const u = new User({ score: "9.5" });
      expect(u.readAttribute("score")).toBe(9.5);
    });

    it("casts string to boolean", () => {
      // Rails BooleanType: "yes"/"no" both truthy (neither in FALSE_VALUES).
      expect(new User({ active: "false" }).readAttribute("active")).toBe(false);
      expect(new User({ active: "true" }).readAttribute("active")).toBe(true);
      expect(new User({ active: "yes" }).readAttribute("active")).toBe(true);
      expect(new User({ active: "no" }).readAttribute("active")).toBe(true);
      expect(new User({ active: "1" }).readAttribute("active")).toBe(true);
      expect(new User({ active: "0" }).readAttribute("active")).toBe(false);
      expect(new User({ active: 1 }).readAttribute("active")).toBe(true);
      expect(new User({ active: 0 }).readAttribute("active")).toBe(false);
    });

    it("casts null to null for all types", () => {
      const u = new User({ name: null, age: null, score: null, active: null });
      expect(u.readAttribute("name")).toBe(null);
      expect(u.readAttribute("age")).toBe(null);
      expect(u.readAttribute("score")).toBe(null);
      expect(u.readAttribute("active")).toBe(null);
    });

    it("writeAttribute casts the value", () => {
      const u = new User();
      u.writeAttribute("age", "42");
      expect(u.readAttribute("age")).toBe(42);
    });

    it("returns all attributes as a hash", () => {
      const u = new User({ name: "dean", age: 30 });
      expect(u.attributes).toEqual({
        name: "dean",
        age: 30,
        score: null,
        active: true,
      });
    });

    it("attributePresent checks for non-blank values", () => {
      const u = new User({ name: "dean" });
      expect(u.attributePresent("name")).toBe(true);
      expect(u.attributePresent("score")).toBe(false);
    });

    it("attributePresent returns false for empty string", () => {
      const u = new User({ name: "" });
      expect(u.attributePresent("name")).toBe(false);
    });

    it("attributePresent returns false for whitespace-only string", () => {
      const u = new User({ name: "   " });
      expect(u.attributePresent("name")).toBe(false);
    });

    it("attributeNames returns declared names", () => {
      expect(User.attributeNames()).toEqual(["name", "age", "score", "active"]);
    });

    it("Proc default is called for each instance", () => {
      let counter = 0;
      class WithLambda extends Model {
        static {
          this.attribute("token", "string", { default: () => `tok_${++counter}` });
        }
      }
      expect(new WithLambda().readAttribute("token")).toBe("tok_1");
      expect(new WithLambda().readAttribute("token")).toBe("tok_2");
    });

    it("inheritance: children inherit parent attributes", () => {
      class Admin extends User {
        static {
          this.attribute("role", "string", { default: "admin" });
        }
      }
      const admin = new Admin({ name: "dean" });
      expect(admin.readAttribute("name")).toBe("dean");
      expect(admin.readAttribute("role")).toBe("admin");
      expect(Admin.attributeNames()).toContain("name");
      expect(Admin.attributeNames()).toContain("role");
    });
  });
});
