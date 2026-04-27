import { describe, it, expect, beforeEach } from "vitest";
import { Base } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

function freshAdapter(): DatabaseAdapter {
  return createTestAdapter();
}

describe("ActiveRecord::QueryMethods", () => {
  let adapter: DatabaseAdapter;
  beforeEach(() => {
    adapter = freshAdapter();
  });

  function makeModel() {
    class Article extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("body", "string");
        this.adapter = adapter;
        (this as any).aliasAttribute("content", "body");
      }
    }
    return Article;
  }

  describe("where with aliased attributes", () => {
    it("resolves alias to the real column name in hash conditions", () => {
      const Article = makeModel();
      const scope = Article.where({ content: "hello" });
      const sql = scope.toSql();
      expect(sql).toMatch(/["`]body["`]/);
      expect(sql).not.toMatch(/["`]content["`]/);
    });

    it("resolves alias to the real column name for array values", () => {
      const Article = makeModel();
      const scope = Article.where({ content: ["a", "b"] });
      const sql = scope.toSql();
      expect(sql).toMatch(/["`]body["`]/);
      expect(sql).not.toMatch(/["`]content["`]/);
    });

    it("passes through non-aliased column names unchanged", () => {
      const Article = makeModel();
      const scope = Article.where({ title: "hello" });
      const sql = scope.toSql();
      expect(sql).toMatch(/["`]title["`]/);
    });
  });
});
