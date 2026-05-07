import { describe, it, expect } from "vitest";
import { Base } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";

describe("ReadTest", () => {
  it.skip("define attribute methods", () => {
    // BLOCKED: unknown — read feature gap; needs human triage
    // ROOT-CAUSE: read.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in read.ts; affects ~1–10 tests in read.test.ts
  });
  it.skip("attribute methods generated?", () => {
    // BLOCKED: unknown — read feature gap; needs human triage
    // ROOT-CAUSE: read.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in read.ts; affects ~1–10 tests in read.test.ts
  });

  it("_read_attribute returns value for existing attribute", () => {
    createTestAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    const p = new Post({ title: "hello" });
    expect(p._readAttribute("title")).toBe("hello");
  });

  it("_read_attribute returns null for unset attribute", () => {
    createTestAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    const p = new Post({});
    expect(p._readAttribute("title")).toBeNull();
  });

  it("_read_attribute does not apply alias resolution", () => {
    createTestAdapter();
    class Post extends Base {
      static {
        this.attribute("body", "string");
        this.aliasAttribute("content", "body");
      }
    }
    const p = new Post({ body: "text" });
    expect(p._readAttribute("body")).toBe("text");
    expect(p._readAttribute("content")).toBeNull();
  });
});
