import { describe, it, expect } from "vitest";
import { Base } from "./index.js";
import { setupHandlerSuite } from "./test-helpers/setup-handler-suite.js";

setupHandlerSuite();

describe("AnnotateTest", () => {
  it("annotate wraps content in an inline comment", () => {
    class Post extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    const sql = Post.all().annotate("foo").toSql();
    expect(sql).toContain("foo");
  });

  it("annotate is sanitized", () => {
    class Post extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    const sql = Post.all().annotate("*/foo/*").toSql();
    expect(sql).toContain("foo");
  });
});
