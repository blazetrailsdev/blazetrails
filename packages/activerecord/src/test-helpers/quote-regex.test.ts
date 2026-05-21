import { describe, expect, it } from "vitest";

import { adapterType } from "../test-adapter.js";
import { q, quoteColumnName, quoteTableName } from "./quote-regex.js";

describe("quote-regex test helpers", () => {
  it("quoteColumnName matches active adapter quoting", () => {
    const out = quoteColumnName("name");
    if (adapterType === "mysql") expect(out).toBe("`name`");
    else expect(out).toBe('"name"');
  });

  it("quoteTableName preserves dotted identifiers", () => {
    const out = quoteTableName("users.name");
    if (adapterType === "mysql") expect(out).toBe("`users`.`name`");
    else expect(out).toBe('"users"."name"');
  });

  it("q escapes regex metacharacters and accepts bare names", () => {
    const pattern = new RegExp(q("name"));
    if (adapterType === "mysql") {
      expect("SELECT `name` FROM x").toMatch(pattern);
      expect('SELECT "name" FROM x').not.toMatch(pattern);
    } else {
      expect('SELECT "name" FROM x').toMatch(pattern);
      expect("SELECT `name` FROM x").not.toMatch(pattern);
    }
  });

  it("q accepts dotted names (Rails quote_table_name semantics)", () => {
    const re = new RegExp(`SELECT \\* FROM ${q("posts.title")}`);
    if (adapterType === "mysql") {
      expect("SELECT * FROM `posts`.`title`").toMatch(re);
    } else {
      expect('SELECT * FROM "posts"."title"').toMatch(re);
    }
  });
});
