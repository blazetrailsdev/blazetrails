import { describe, it, expect } from "vitest";
import { ValueType } from "@blazetrails/activemodel";
import { Base } from "./base.js";
import { resetColumnInformation } from "./model-schema.js";

class UuidType extends ValueType {
  override readonly name = "uuid" as unknown as "value";
}

function makeAdapter(columns: Record<string, unknown>): unknown {
  return {
    schemaCache: {
      isCached: () => true,
      getCachedColumnsHash: () => columns,
      dataSourceExists: async () => true,
      columnsHash: async () => columns,
    },
    lookupCastTypeFromColumn(column: { sqlType: string }) {
      return column.sqlType === "uuid" ? new UuidType() : null;
    },
  };
}

describe("sync loadSchema / columnsHash", () => {
  it("columnsHash returns cached Column objects when schema cache is populated", () => {
    class Post extends Base {
      static override tableName = "posts";
    }
    const cols = { guid: { sqlType: "uuid", name: "guid", default: null } };
    (Post as unknown as { adapter: unknown }).adapter = makeAdapter(cols);

    const hash = Post.columnsHash();

    expect(hash.guid).toBe(cols.guid);
    expect(Post._attributeDefinitions.get("guid")?.source).toBe("schema");
  });

  it("columnsHash filters ignoredColumns out of the cached hash", () => {
    class Post extends Base {
      static override tableName = "posts";
    }
    (Post as unknown as { _ignoredColumns: string[] })._ignoredColumns = ["secret"];
    const cols = {
      guid: { sqlType: "uuid", name: "guid", default: null },
      secret: { sqlType: "uuid", name: "secret", default: null },
    };
    (Post as unknown as { adapter: unknown }).adapter = makeAdapter(cols);

    const hash = Post.columnsHash();

    expect(hash.guid).toBeDefined();
    expect(hash.secret).toBeUndefined();
  });

  it("falls back to synthesized hash when no schema cache is available", () => {
    class Widget extends Base {
      static override tableName = "widgets";
      static {
        this.attribute("name", "string");
      }
    }
    // No adapter — loadSchema's fallback path kicks in.
    const hash = Widget.columnsHash();
    expect(hash.name.type).toBe("string");
  });

  it("STI subclass reflection delegates to base, without forking defs", () => {
    class Shape extends Base {
      static override tableName = "shapes";
      static {
        this.inheritanceColumn = "type";
        this.attribute("type", "string");
      }
    }
    class Circle extends Shape {}

    const cols = { guid: { sqlType: "uuid", name: "guid", default: null } };
    (Shape as unknown as { adapter: unknown }).adapter = makeAdapter(cols);
    (Circle as unknown as { adapter: unknown }).adapter = makeAdapter(cols);

    // Trigger load on subclass — must reflect on the STI base, not fork.
    Circle.columnsHash();

    expect(Object.prototype.hasOwnProperty.call(Circle, "_attributeDefinitions")).toBe(false);
    expect(Shape._attributeDefinitions.get("guid")?.source).toBe("schema");
    expect(Circle._attributeDefinitions.get("guid")?.source).toBe("schema");
  });

  it("resetColumnInformation drops schema-sourced defs but preserves user defs", () => {
    class Post extends Base {
      static override tableName = "posts";
      static {
        this.attribute("title", "string");
      }
    }
    const cols = { guid: { sqlType: "uuid", name: "guid", default: null } };
    (Post as unknown as { adapter: unknown }).adapter = makeAdapter(cols);
    Post.columnsHash(); // triggers reflection

    expect(Post._attributeDefinitions.get("guid")?.source).toBe("schema");
    expect(Post._attributeDefinitions.get("title")?.source).toBe("user");

    (resetColumnInformation as any).call(Post);

    expect(Post._attributeDefinitions.has("guid")).toBe(false);
    expect(Post._attributeDefinitions.get("title")?.source).toBe("user");
  });
});
