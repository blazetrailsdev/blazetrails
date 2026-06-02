/**
 * Mirrors activerecord/test/cases/assertions/query_assertions_test.rb —
 * the `assert_queries_match` / `assert_no_queries_match` surface. Test names
 * match the Rails `test_*` methods verbatim (minus the `test_` prefix).
 *
 * Rails uses the canonical `Post` model; here a minimal `Post` (table `posts`)
 * reproduces the same SQL shapes. Unlike Rails, trails' `.first` does not add
 * an implicit `ORDER BY <pk> ASC`, so the queries below pass `.order("id")`
 * explicitly to reproduce Rails' default-ordered `.first` and keep the
 * `/ASC LIMIT/i` / `/ORDER BY/i` matchers identical to the Rails test.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";

import { Notifications } from "@blazetrails/activesupport";
import { Base } from "../index.js";
import { defineSchema } from "./define-schema.js";
import { setupHandlerSuite } from "./setup-handler-suite.js";
import { useHandlerTransactionalFixtures } from "./use-handler-transactional-fixtures.js";
import { SQLCounter, assertQueriesMatch, assertNoQueriesMatch } from "./assert-queries-match.js";

class Post extends Base {
  static {
    this.attribute("title", "string");
  }
}

const TEST_SCHEMA = {
  posts: { title: "string" },
} as const;

describe("QueryAssertionsTest", () => {
  setupHandlerSuite();
  useHandlerTransactionalFixtures();

  beforeAll(async () => {
    await defineSchema(TEST_SCHEMA);
  });

  afterEach(() => {
    Notifications.unsubscribeAll();
  });

  it("assert_queries_match", async () => {
    await assertQueriesMatch(/ASC LIMIT/i, { count: 1 }, () => Post.order("id").first());
    await assertQueriesMatch(/ASC LIMIT/i, () => Post.order("id").first());

    await expect(
      assertQueriesMatch(/ASC LIMIT/i, { count: 2 }, () => Post.order("id").first()),
    ).rejects.toThrow(/1 instead of 2 queries/);

    await expect(
      assertQueriesMatch(/ASC LIMIT/i, { count: 0 }, () => Post.order("id").first()),
    ).rejects.toThrow(/1 instead of 0 queries/);
  });

  it("assert_queries_match_with_matcher", async () => {
    await expect(
      assertQueriesMatch(/WHERE "posts"."id" = \? LIMIT \?/, { count: 1 }, () =>
        Post.where({ id: 1 }).order("id").first(),
      ),
    ).rejects.toThrow(/0 instead of 1 queries/);
  });

  it("assert_queries_match_when_there_are_no_queries", async () => {
    await expect(assertQueriesMatch(/something/, () => Post.none())).rejects.toThrow(
      /1 or more queries expected, but none were executed/,
    );
  });

  it("assert_no_queries_match", async () => {
    await assertNoQueriesMatch(/something/, () => Post.none());

    await expect(assertNoQueriesMatch(/ORDER BY/i, () => Post.order("id").first())).rejects.toThrow(
      /1 instead of 0/,
    );
  });

  it("assert_no_queries_match_matcher", async () => {
    await expect(assertNoQueriesMatch(/ORDER BY/i, () => Post.order("id").first())).rejects.toThrow(
      /1 instead of 0/,
    );
  });

  describe("SQLCounter", () => {
    it("collects non-SCHEMA queries and exposes log / logAll", () => {
      const counter = new SQLCounter();
      counter.call(evt({ sql: "SELECT 1" }));
      counter.call(evt({ sql: "PRAGMA table_info(posts)", name: "SCHEMA" }));
      counter.call(evt({ sql: "SELECT 2", cached: true }));

      expect(counter.log).toEqual(["SELECT 1"]);
      expect(counter.logAll).toEqual(["SELECT 1", "PRAGMA table_info(posts)"]);
    });

    it("maps bound values through valueForDatabase", () => {
      const counter = new SQLCounter();
      const bind = { valueForDatabase: () => 42 };
      counter.call(evt({ sql: "SELECT ?", binds: [bind, 7] }));

      expect(counter.logFull).toEqual([["SELECT ?", [42, 7]]]);
    });
  });
});

function evt(payload: Record<string, unknown>) {
  return { payload } as Parameters<SQLCounter["call"]>[0];
}
