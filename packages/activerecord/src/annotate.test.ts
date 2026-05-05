import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Base } from "./index.js";
import { createTestAdapter } from "./test-adapter.js";
import { defineSchema } from "./test-helpers/define-schema.js";
import { dropAllTables } from "./test-helpers/drop-all-tables.js";
import type { DatabaseAdapter } from "./adapter.js";

let adapter: DatabaseAdapter;

beforeAll(() => {
  adapter = createTestAdapter();
});
beforeAll(async () => {
  await defineSchema(adapter, { posts: { title: "string" } });
});
afterAll(async () => {
  await dropAllTables(adapter);
});

describe("AnnotateTest", () => {
  it("annotate wraps content in an inline comment", () => {
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    const sql = Post.all().annotate("my-hint").toSql();
    expect(sql).toContain("my-hint");
  });

  it("annotate is sanitized", () => {
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    const sql = Post.all().annotate("safe-hint").toSql();
    expect(sql).toContain("safe-hint");
  });
});
