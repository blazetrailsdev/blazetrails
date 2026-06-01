/**
 * Tests to increase Rails test coverage matching.
 * Test names are chosen to match Ruby test names from the Rails test suite.
 * Mirrors: activerecord/test/cases/annotate_test.rb
 */
import { describe, it, expect } from "vitest";
import "./index.js";
import { setupHandlerSuite } from "./test-helpers/setup-handler-suite.js";
import { useHandlerFixtures } from "./test-helpers/use-handler-fixtures.js";
import { TEST_SCHEMA as canonicalSchema } from "./test-helpers/test-schema.js";
import { Post } from "./test-helpers/models/post.js";

describe("AnnotateTest", () => {
  setupHandlerSuite();
  // Mirrors Rails `fixtures :posts` — seed the canonical posts rows so the
  // annotated `select(:id)` relation has data to read back with `.first()`
  // (Rails' `assert posts.first`). `schema` recreates the canonical `posts`
  // table so the shared Post model resolves regardless of any bespoke `posts`
  // a sibling file left in the shared worker DB.
  const { posts } = useHandlerFixtures(["posts"], { schema: canonicalSchema });

  it("annotate wraps content in an inline comment", async () => {
    const relation = Post.select("id").annotate("foo");
    expect(relation.toSql()).toMatch(/\/\* foo \*\//);
    expect((await relation.first())?.id).toBe(posts("welcome").id);
  });

  it("annotate is sanitized", async () => {
    const sql = Post.select("id").annotate("*/foo/*").toSql();
    expect(sql).toContain("foo");

    const sql2 = Post.select("id").annotate("**//foo//**").toSql();
    expect(sql2).toContain("foo");

    const sql3 = Post.select("id").annotate("*/foo/*").annotate("*/bar").toSql();
    expect(sql3).toContain("foo");
    expect(sql3).toContain("bar");

    const sql4 = Post.select("id").annotate("+ MAX_EXECUTION_TIME(1)").toSql();
    expect(sql4).toContain("MAX_EXECUTION_TIME");
    // This annotation has no `*/` terminator, so the wrapped comment is valid
    // SQL and the annotated relation reads the seeded fixtures back like Rails.
    const annotated = Post.select("id").annotate("+ MAX_EXECUTION_TIME(1)");
    expect((await annotated.first())?.id).toBe(posts("welcome").id);
  });
});
