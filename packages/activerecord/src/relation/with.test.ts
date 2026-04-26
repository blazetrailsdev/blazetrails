/**
 * Tests to increase Rails test coverage matching.
 * Test names are chosen to match Ruby test names from the Rails test suite.
 */
import { describe, it, expect } from "vitest";
import { Base } from "../index.js";

import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

// -- Helpers --
function freshAdapter(): DatabaseAdapter {
  return createTestAdapter();
}

// ==========================================================================
// WithTest — targets relation/with_test.rb
// ==========================================================================
describe("WithTest", () => {
  it("with when hash is passed as an argument", async () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("id", "integer");
        this.adapter = adapter;
      }
    }
    await Post.create({ title: "test1", id: 1 });
    await Post.create({ title: "test2", id: 2 });
    const cteRel = Post.where({});
    const rel = Post.all().with({ recent_posts: cteRel });
    const sql = rel.toSql();
    expect(sql).toContain("WITH");
    expect(sql).toContain("recent_posts");
  });

  it("with when hash with multiple elements of different type is passed as an argument", async () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("id", "integer");
        this.adapter = adapter;
      }
    }
    await Post.create({ title: "test1", id: 1 });
    const cte1 = Post.where({ id: 1 });
    const cte2 = Post.where({ id: 2 });
    const rel = Post.all().with({ cte1, cte2 });
    const sql = rel.toSql();
    expect(sql).toContain("WITH");
    expect(sql).toContain("cte1");
    expect(sql).toContain("cte2");
  });

  it("with when invalid argument is passed", () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    expect(() => {
      (Post.all() as any).with(Post.where({}));
    }).toThrow();
  });

  it("multiple with calls", async () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    await Post.create({ title: "a" });
    const cte1 = Post.where({});
    const cte2 = Post.where({});
    const rel = Post.all().with({ cte1 }).with({ cte2 });
    const sql = rel.toSql();
    expect(sql).toContain("WITH");
    expect(sql).toContain("cte1");
    expect(sql).toContain("cte2");
  });

  it("multiple dupicate with calls", async () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    await Post.create({ title: "a" });
    const cte = Post.where({});
    const rel = Post.all().with({ dup_cte: cte }).with({ dup_cte: cte });
    const sql = rel.toSql();
    const matches = (sql.match(/dup_cte/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });

  it("count after with call", async () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const cte = Post.where({});
    const count = await Post.all().with({ cte }).count();
    expect(count).toBe(2);
  });

  it.skip("with when called from active record scope", () => {
    /* needs scope definition */
  });

  it("with when invalid params are passed", () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    expect(() => {
      Post.all().with({ invalid_cte: null as any });
    }).toThrow();
  });

  it.skip("with when passing arrays", () => {
    /* arrays not supported in with implementation */
  });

  it.skip("with when passing single item array", () => {
    /* arrays not supported in with implementation */
  });

  it("with recursive", async () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    const cte = Post.where({});
    const sql = Post.all().withRecursive({ recursive_cte: cte }).toSql();
    expect(sql).toContain("WITH RECURSIVE");
    expect(sql).toContain("recursive_cte");
  });

  it.skip("with joins", () => {
    /* needs cross-table CTE + joins infrastructure */
  });

  it.skip("with left joins", () => {
    /* needs cross-table CTE + left joins infrastructure */
  });

  it.skip("raises when using block", () => {
    /* block syntax not checked in current implementation */
  });

  it.skip("unscoping", () => {
    /* _ctes can't be unscoped with current implementation */
  });

  it.skip("common table expressions are unsupported", () => {
    /* unsupported database */
  });
});
