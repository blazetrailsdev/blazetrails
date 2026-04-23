import { describe, it, expect } from "vitest";
import { Base } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";

describe("WriteTest", () => {
  it("_write_attribute writes value to attribute", () => {
    createTestAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    const p = new Post({ title: "old" });
    p._writeAttribute("title", "new");
    expect(p.readAttribute("title")).toBe("new");
  });

  it("_write_attribute writes to canonical name, not through aliases", () => {
    createTestAdapter();
    class Post extends Base {
      static {
        this.attribute("body", "string");
        this.aliasAttribute("content", "body");
      }
    }
    const p = new Post({ body: "original" });
    // alias "content" → "body"; _writeAttribute("body") writes directly to body
    p._writeAttribute("body", "updated");
    expect(p.readAttribute("body")).toBe("updated");
  });

  it("_write_attribute bypasses readonly check", () => {
    createTestAdapter();
    class Item extends Base {
      static {
        this.attribute("code", "string");
        this.attrReadonly("code");
      }
    }
    const item = new Item({ code: "A" });
    (item as any)._newRecord = false;
    expect(() => item._writeAttribute("code", "B")).not.toThrow();
    expect(item.readAttribute("code")).toBe("B");
  });
});
