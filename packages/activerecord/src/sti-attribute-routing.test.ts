import { describe, it, expect } from "vitest";
import { Base } from "./base.js";

describe("STI subclass attribute() routing", () => {
  it("writes subclass attribute() calls to the STI base's _attributeDefinitions", () => {
    class Shape extends Base {
      static override tableName = "shapes";
      static {
        this.inheritanceColumn = "type";
      }
    }
    class Circle extends Shape {
      static {
        this.attribute("radius", "integer");
      }
    }

    // Both classes see radius via the shared (base-owned) map.
    expect(Shape._attributeDefinitions.has("radius")).toBe(true);
    expect(Circle._attributeDefinitions.has("radius")).toBe(true);
    expect(Circle._attributeDefinitions).toBe(Shape._attributeDefinitions);

    // Circle didn't fork its own map.
    expect(Object.prototype.hasOwnProperty.call(Circle, "_attributeDefinitions")).toBe(false);
  });

  it("still forks the STI base itself (non-subclass) on attribute() — unchanged", () => {
    class Shape extends Base {
      static override tableName = "shapes";
      static {
        this.inheritanceColumn = "type";
        this.attribute("name", "string");
      }
    }

    // Shape IS the STI base (not a subclass), so its map is its own.
    expect(Object.prototype.hasOwnProperty.call(Shape, "_attributeDefinitions")).toBe(true);
    expect(Shape._attributeDefinitions.get("name")?.userProvided).toBe(true);
  });

  it("non-STI classes are unaffected", () => {
    class Widget extends Base {
      static {
        this.attribute("price", "integer");
      }
    }

    expect(Object.prototype.hasOwnProperty.call(Widget, "_attributeDefinitions")).toBe(true);
    expect(Widget._attributeDefinitions.get("price")?.userProvided).toBe(true);
  });

  it("STI subclass attribute declared AFTER base sees both attrs on the shared map", () => {
    class Shape extends Base {
      static override tableName = "shapes";
      static {
        this.inheritanceColumn = "type";
        this.attribute("name", "string");
      }
    }
    class Triangle extends Shape {
      static {
        this.attribute("sides", "integer");
      }
    }

    expect(Triangle._attributeDefinitions.get("name")?.type.name).toBe("string");
    expect(Triangle._attributeDefinitions.get("sides")?.type.name).toBe("integer");
    expect(Shape._attributeDefinitions.get("sides")?.type.name).toBe("integer");
  });
});
