import { describe, it, expect } from "vitest";
import {
  Table,
  sql,
  star,
  SelectManager,
  InsertManager,
  UpdateManager,
  DeleteManager,
  Nodes,
  Visitors,
  Collectors,
} from "./index.js";

describe("Arel", () => {
  const users = new Table("users");
  const posts = new Table("posts");

  // =========================================================================
  // Phase 100/150 — Table and Core AST
  // =========================================================================
  describe("Table", () => {
    it("has a name", () => {
      expect(users.name).toBe("users");
    });

    it("manufactures an Attribute via get()", () => {
      const attr = users.get("id");
      expect(attr).toBeInstanceOf(Nodes.Attribute);
      expect(attr.name).toBe("id");
      expect(attr.relation).toBe(users);
    });

    it("manufactures an Attribute via attr()", () => {
      expect(users.attr("email").name).toBe("email");
    });

    it("accepts :as option for table alias", () => {
      const aliased = new Table("users", { as: "u" });
      expect(aliased.tableAlias).toBe("u");
    });

    it("star returns table.*", () => {
      expect(users.star.value).toBe('"users".*');
    });

    it("project returns a SelectManager", () => {
      const mgr = users.project(star);
      expect(mgr).toBeInstanceOf(SelectManager);
    });

    it("alias references use the alias in SQL", () => {
      const u = new Table("users", { as: "u" });
      const result = u.project(u.get("name")).toSql();
      expect(result).toBe('SELECT "u"."name" FROM "users" "u"');
    });
  });

  // =========================================================================
  // Phase 200/250 — SQL Visitor
  // =========================================================================
  describe("ToSql Visitor", () => {
    const visitor = new Visitors.ToSql();

    it("generates SELECT *", () => {
      expect(users.project(star).toSql()).toBe('SELECT * FROM "users"');
    });

    it("generates SELECT with specific columns", () => {
      expect(
        users.project(users.get("name"), users.get("email")).toSql()
      ).toBe('SELECT "users"."name", "users"."email" FROM "users"');
    });

    it("handles string escaping (single quotes)", () => {
      const result = users
        .project(star)
        .where(users.get("name").eq("O'Brien"))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE "users"."name" = 'O''Brien'`
      );
    });

    it("handles boolean false", () => {
      const result = users
        .project(star)
        .where(users.get("active").eq(false))
        .toSql();
      expect(result).toContain("FALSE");
    });

    it("handles boolean true", () => {
      const result = users
        .project(star)
        .where(users.get("active").eq(true))
        .toSql();
      expect(result).toContain("TRUE");
    });

    it("Grouping produces single layer of parens", () => {
      const grouped = new Nodes.Grouping(new Nodes.Quoted("foo"));
      const result = visitor.compile(grouped);
      expect(result).toBe("('foo')");
    });

    it("Not applies to expression", () => {
      const cond = users.get("name").eq("dean").not();
      const result = users.project(star).where(cond).toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE NOT ("users"."name" = 'dean')`
      );
    });

    it("multiple WHEREs are ANDed", () => {
      const result = users
        .project(star)
        .where(users.get("age").gt(21))
        .where(users.get("name").eq("dean"))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE "users"."age" > 21 AND "users"."name" = 'dean'`
      );
    });

    it("SqlLiteral is not quoted", () => {
      const result = visitor.compile(new Nodes.SqlLiteral("NOW()"));
      expect(result).toBe("NOW()");
    });
  });

  // =========================================================================
  // Phase 300 — Predicates
  // =========================================================================
  describe("Attribute predicates", () => {
    // -- Equality --
    it("eq generates =", () => {
      expect(
        users.project(star).where(users.get("id").eq(10)).toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."id" = 10');
    });

    it("eq(null) generates IS NULL", () => {
      expect(
        users.project(star).where(users.get("name").eq(null)).toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."name" IS NULL');
    });

    it("notEq generates !=", () => {
      expect(
        users.project(star).where(users.get("id").notEq(10)).toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."id" != 10');
    });

    it("notEq(null) generates IS NOT NULL", () => {
      expect(
        users.project(star).where(users.get("name").notEq(null)).toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."name" IS NOT NULL');
    });

    // -- Comparison --
    it("gt generates >", () => {
      expect(
        users.project(star).where(users.get("age").gt(10)).toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."age" > 10');
    });

    it("gteq generates >=", () => {
      expect(
        users.project(star).where(users.get("age").gteq(10)).toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."age" >= 10');
    });

    it("lt generates <", () => {
      expect(
        users.project(star).where(users.get("age").lt(10)).toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."age" < 10');
    });

    it("lteq generates <=", () => {
      expect(
        users.project(star).where(users.get("age").lteq(10)).toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."age" <= 10');
    });

    // -- Pattern --
    it("matches generates LIKE", () => {
      expect(
        users
          .project(star)
          .where(users.get("name").matches("%bacon%"))
          .toSql()
      ).toBe(
        `SELECT * FROM "users" WHERE "users"."name" LIKE '%bacon%'`
      );
    });

    it("doesNotMatch generates NOT LIKE", () => {
      expect(
        users
          .project(star)
          .where(users.get("name").doesNotMatch("%bacon%"))
          .toSql()
      ).toBe(
        `SELECT * FROM "users" WHERE "users"."name" NOT LIKE '%bacon%'`
      );
    });

    // -- IN --
    it("in generates IN", () => {
      expect(
        users
          .project(star)
          .where(users.get("id").in([1, 2, 3]))
          .toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."id" IN (1, 2, 3)');
    });

    it("in with empty array generates 1=0 (always false)", () => {
      expect(
        users.project(star).where(users.get("id").in([])).toSql()
      ).toBe('SELECT * FROM "users" WHERE 1=0');
    });

    it("notIn generates NOT IN", () => {
      expect(
        users
          .project(star)
          .where(users.get("id").notIn([1, 2]))
          .toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."id" NOT IN (1, 2)');
    });

    it("notIn with empty array generates 1=1 (always true)", () => {
      expect(
        users.project(star).where(users.get("id").notIn([])).toSql()
      ).toBe('SELECT * FROM "users" WHERE 1=1');
    });

    // -- Between --
    it("between generates BETWEEN", () => {
      expect(
        users
          .project(star)
          .where(users.get("age").between(18, 65))
          .toSql()
      ).toBe(
        'SELECT * FROM "users" WHERE "users"."age" BETWEEN 18 AND 65'
      );
    });

    // -- Null helpers --
    it("isNull generates IS NULL", () => {
      expect(
        users
          .project(star)
          .where(users.get("name").isNull())
          .toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."name" IS NULL');
    });

    it("isNotNull generates IS NOT NULL", () => {
      expect(
        users
          .project(star)
          .where(users.get("name").isNotNull())
          .toSql()
      ).toBe('SELECT * FROM "users" WHERE "users"."name" IS NOT NULL');
    });

    // -- Boolean combinators --
    it("and combines with AND", () => {
      const cond = users.get("name").eq("dean").and(users.get("age").gt(21));
      expect(users.project(star).where(cond).toSql()).toBe(
        `SELECT * FROM "users" WHERE "users"."name" = 'dean' AND "users"."age" > 21`
      );
    });

    it("or combines with OR wrapped in Grouping", () => {
      const cond = users.get("name").eq("dean").or(users.get("name").eq("sam"));
      expect(users.project(star).where(cond).toSql()).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" = 'dean' OR "users"."name" = 'sam')`
      );
    });

    it("not negates", () => {
      const cond = users.get("name").eq("dean").not();
      expect(users.project(star).where(cond).toSql()).toBe(
        `SELECT * FROM "users" WHERE NOT ("users"."name" = 'dean')`
      );
    });
  });

  // =========================================================================
  // Phase 150 — _any / _all variants
  // =========================================================================
  describe("Attribute _any/_all variants", () => {
    it("eqAny generates OR group", () => {
      const result = users
        .project(star)
        .where(users.get("name").eqAny(["dean", "sam"]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" = 'dean' OR "users"."name" = 'sam')`
      );
    });

    it("eqAll generates AND group", () => {
      const result = users
        .project(star)
        .where(users.get("name").eqAll(["dean", "sam"]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" = 'dean' AND "users"."name" = 'sam')`
      );
    });

    it("gtAny generates OR group", () => {
      const result = users
        .project(star)
        .where(users.get("age").gtAny([10, 20]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."age" > 10 OR "users"."age" > 20)`
      );
    });

    it("ltAll generates AND group", () => {
      const result = users
        .project(star)
        .where(users.get("age").ltAll([50, 100]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."age" < 50 AND "users"."age" < 100)`
      );
    });

    it("matchesAny generates OR group", () => {
      const result = users
        .project(star)
        .where(users.get("name").matchesAny(["%dean%", "%sam%"]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" LIKE '%dean%' OR "users"."name" LIKE '%sam%')`
      );
    });

    it("does not mutate input array", () => {
      const input = [1, 2, 3];
      const copy = [...input];
      users.get("id").eqAny(input);
      expect(input).toEqual(copy);
    });
  });

  // =========================================================================
  // Phase 300 — Ordering
  // =========================================================================
  describe("Ordering", () => {
    it("asc generates ASC", () => {
      expect(
        users
          .project(star)
          .order(users.get("name").asc())
          .toSql()
      ).toBe('SELECT * FROM "users" ORDER BY "users"."name" ASC');
    });

    it("desc generates DESC", () => {
      expect(
        users
          .project(star)
          .order(users.get("name").desc())
          .toSql()
      ).toBe('SELECT * FROM "users" ORDER BY "users"."name" DESC');
    });

    it("multiple order clauses", () => {
      expect(
        users
          .project(star)
          .order(users.get("name").asc(), users.get("age").desc())
          .toSql()
      ).toBe(
        'SELECT * FROM "users" ORDER BY "users"."name" ASC, "users"."age" DESC'
      );
    });

    it("Ascending has direction 'asc'", () => {
      const asc = users.get("name").asc();
      expect(asc.direction).toBe("asc");
      expect(asc.isAscending()).toBe(true);
      expect(asc.isDescending()).toBe(false);
    });

    it("Descending has direction 'desc'", () => {
      const desc = users.get("name").desc();
      expect(desc.direction).toBe("desc");
      expect(desc.isDescending()).toBe(true);
      expect(desc.isAscending()).toBe(false);
    });

    it("Ascending.reverse() returns Descending", () => {
      const asc = users.get("name").asc();
      const reversed = asc.reverse();
      expect(reversed).toBeInstanceOf(Nodes.Descending);
      expect(reversed.direction).toBe("desc");
    });

    it("Descending.reverse() returns Ascending", () => {
      const desc = users.get("name").desc();
      const reversed = desc.reverse();
      expect(reversed).toBeInstanceOf(Nodes.Ascending);
      expect(reversed.direction).toBe("asc");
    });
  });

  // =========================================================================
  // Phase 300 — Math and aliasing
  // =========================================================================
  describe("Math operations", () => {
    it("add generates +", () => {
      expect(
        users.project(users.get("age").add(1).as("next")).toSql()
      ).toBe('SELECT "users"."age" + 1 AS next FROM "users"');
    });

    it("subtract generates -", () => {
      expect(
        users.project(users.get("age").subtract(1).as("prev")).toSql()
      ).toBe('SELECT "users"."age" - 1 AS prev FROM "users"');
    });

    it("multiply generates *", () => {
      expect(
        users.project(users.get("age").multiply(2).as("double")).toSql()
      ).toBe('SELECT "users"."age" * 2 AS double FROM "users"');
    });

    it("divide generates /", () => {
      expect(
        users.project(users.get("age").divide(2).as("half")).toSql()
      ).toBe('SELECT "users"."age" / 2 AS half FROM "users"');
    });
  });

  // =========================================================================
  // Phase 400/450 — SelectManager
  // =========================================================================
  describe("SelectManager", () => {
    it("chains where + order + limit + offset", () => {
      expect(
        users
          .project(users.get("name"))
          .where(users.get("age").gt(21))
          .order(users.get("name").asc())
          .take(10)
          .skip(5)
          .toSql()
      ).toBe(
        'SELECT "users"."name" FROM "users" WHERE "users"."age" > 21 ORDER BY "users"."name" ASC LIMIT 10 OFFSET 5'
      );
    });

    it("inner join", () => {
      expect(
        users
          .project(users.get("name"), posts.get("title"))
          .join(posts, users.get("id").eq(posts.get("user_id")))
          .toSql()
      ).toBe(
        'SELECT "users"."name", "posts"."title" FROM "users" INNER JOIN "posts" ON "users"."id" = "posts"."user_id"'
      );
    });

    it("left outer join", () => {
      expect(
        users
          .project(star)
          .outerJoin(posts, users.get("id").eq(posts.get("user_id")))
          .toSql()
      ).toBe(
        'SELECT * FROM "users" LEFT OUTER JOIN "posts" ON "users"."id" = "posts"."user_id"'
      );
    });

    it("group by and having", () => {
      expect(
        users
          .project(users.get("age"), sql("COUNT(*)"))
          .group(users.get("age"))
          .having(sql("COUNT(*) > 1"))
          .toSql()
      ).toBe(
        'SELECT "users"."age", COUNT(*) FROM "users" GROUP BY "users"."age" HAVING COUNT(*) > 1'
      );
    });

    it("distinct", () => {
      expect(
        users.project(users.get("name")).distinct().toSql()
      ).toBe('SELECT DISTINCT "users"."name" FROM "users"');
    });

    it("lock generates FOR UPDATE", () => {
      expect(
        users.project(star).lock().toSql()
      ).toBe('SELECT * FROM "users" FOR UPDATE');
    });

    it("chaining returns the manager", () => {
      const mgr = users.project(star);
      expect(mgr.where(users.get("id").eq(1))).toBe(mgr);
      expect(mgr.order(users.get("id").asc())).toBe(mgr);
      expect(mgr.take(10)).toBe(mgr);
      expect(mgr.skip(5)).toBe(mgr);
      expect(mgr.group(users.get("id"))).toBe(mgr);
    });
  });

  // =========================================================================
  // Phase 400 — InsertManager
  // =========================================================================
  describe("InsertManager", () => {
    it("generates INSERT", () => {
      const mgr = new InsertManager();
      mgr.into(users);
      mgr.insert([
        [users.get("name"), "dean"],
        [users.get("age"), 30],
      ]);
      expect(mgr.toSql()).toBe(
        `INSERT INTO "users" ("name", "age") VALUES ('dean', 30)`
      );
    });

    it("handles null values", () => {
      const mgr = new InsertManager();
      mgr.into(users);
      mgr.insert([[users.get("name"), null]]);
      expect(mgr.toSql()).toBe(
        `INSERT INTO "users" ("name") VALUES (NULL)`
      );
    });

    it("handles boolean false", () => {
      const mgr = new InsertManager();
      mgr.into(users);
      mgr.insert([[users.get("active"), false]]);
      expect(mgr.toSql()).toContain("FALSE");
    });
  });

  // =========================================================================
  // Phase 400 — UpdateManager
  // =========================================================================
  describe("UpdateManager", () => {
    it("generates UPDATE with WHERE", () => {
      const mgr = new UpdateManager();
      mgr.table(users);
      mgr.set([
        [users.get("name"), "dean"],
        [users.get("age"), 31],
      ]);
      mgr.where(users.get("id").eq(1));
      expect(mgr.toSql()).toBe(
        `UPDATE "users" SET "users"."name" = 'dean', "users"."age" = 31 WHERE "users"."id" = 1`
      );
    });

    it("handles null set value", () => {
      const mgr = new UpdateManager();
      mgr.table(users);
      mgr.set([[users.get("name"), null]]);
      mgr.where(users.get("id").eq(1));
      expect(mgr.toSql()).toContain("= NULL");
    });
  });

  // =========================================================================
  // Phase 400 — DeleteManager
  // =========================================================================
  describe("DeleteManager", () => {
    it("generates DELETE with WHERE", () => {
      const mgr = new DeleteManager();
      mgr.from(users);
      mgr.where(users.get("id").eq(1));
      expect(mgr.toSql()).toBe(
        'DELETE FROM "users" WHERE "users"."id" = 1'
      );
    });

    it("chaining returns the manager", () => {
      const mgr = new DeleteManager();
      expect(mgr.from(users)).toBe(mgr);
      expect(mgr.where(users.get("id").eq(1))).toBe(mgr);
    });
  });

  // =========================================================================
  // Phase 500 — Advanced Features
  // =========================================================================
  describe("Advanced", () => {
    const visitor = new Visitors.ToSql();

    it("Arel.sql() for raw SQL", () => {
      expect(users.project(sql("NOW()")).toSql()).toBe(
        'SELECT NOW() FROM "users"'
      );
    });

    it("Arel.star for *", () => {
      expect(users.project(star).toSql()).toBe('SELECT * FROM "users"');
    });

    // -- Named functions --
    it("NamedFunction: COUNT(*)", () => {
      const count = new Nodes.NamedFunction("COUNT", [star]);
      expect(users.project(count).toSql()).toBe(
        'SELECT COUNT(*) FROM "users"'
      );
    });

    it("NamedFunction: SUM with alias", () => {
      const sum = new Nodes.NamedFunction("SUM", [users.get("age")]);
      expect(users.project(sum.as("total")).toSql()).toBe(
        'SELECT SUM("users"."age") AS total FROM "users"'
      );
    });

    it("NamedFunction: DISTINCT", () => {
      const count = new Nodes.NamedFunction(
        "COUNT",
        [users.get("name")],
        undefined,
        true
      );
      expect(users.project(count).toSql()).toBe(
        'SELECT COUNT(DISTINCT "users"."name") FROM "users"'
      );
    });

    // -- Aggregate convenience methods --
    it("attribute.count()", () => {
      expect(users.project(users.get("id").count()).toSql()).toBe(
        'SELECT COUNT("users"."id") FROM "users"'
      );
    });

    it("attribute.sum()", () => {
      expect(users.project(users.get("age").sum()).toSql()).toBe(
        'SELECT SUM("users"."age") FROM "users"'
      );
    });

    it("attribute.maximum()", () => {
      expect(users.project(users.get("age").maximum()).toSql()).toBe(
        'SELECT MAX("users"."age") FROM "users"'
      );
    });

    it("attribute.minimum()", () => {
      expect(users.project(users.get("age").minimum()).toSql()).toBe(
        'SELECT MIN("users"."age") FROM "users"'
      );
    });

    it("attribute.average()", () => {
      expect(users.project(users.get("age").average()).toSql()).toBe(
        'SELECT AVG("users"."age") FROM "users"'
      );
    });

    // -- Set operations --
    it("UNION", () => {
      const q1 = users.project(users.get("name")).where(users.get("age").gt(21));
      const q2 = users.project(users.get("name")).where(users.get("age").lt(18));
      const union = q1.union(q2);
      const compiled = visitor.compile(union);
      expect(compiled).toContain("UNION");
      expect(compiled).toContain('"users"."age" > 21');
      expect(compiled).toContain('"users"."age" < 18');
    });

    it("UNION ALL", () => {
      const q1 = users.project(star);
      const q2 = users.project(star);
      const compiled = visitor.compile(q1.unionAll(q2));
      expect(compiled).toContain("UNION ALL");
    });

    it("INTERSECT", () => {
      const q1 = users.project(star);
      const q2 = users.project(star);
      const compiled = visitor.compile(q1.intersect(q2));
      expect(compiled).toContain("INTERSECT");
    });

    it("EXCEPT", () => {
      const q1 = users.project(star);
      const q2 = users.project(star);
      const compiled = visitor.compile(q1.except(q2));
      expect(compiled).toContain("EXCEPT");
    });

    // -- EXISTS --
    it("EXISTS wraps subquery", () => {
      const subquery = users.project(star).where(users.get("age").gt(21));
      const compiled = visitor.compile(subquery.exists());
      expect(compiled).toContain("EXISTS");
      expect(compiled).toContain('"users"."age" > 21');
    });

    // -- Window functions --
    it("OVER with PARTITION BY and ORDER BY", () => {
      const w = new Nodes.Window();
      w.partition(users.get("department_id"));
      w.order(users.get("salary").desc());
      const fn = new Nodes.NamedFunction("ROW_NUMBER", []);
      const compiled = visitor.compile(new Nodes.Over(fn, w));
      expect(compiled).toContain("ROW_NUMBER()");
      expect(compiled).toContain("OVER");
      expect(compiled).toContain("PARTITION BY");
      expect(compiled).toContain("ORDER BY");
    });

    it("OVER with empty window", () => {
      const fn = new Nodes.NamedFunction("ROW_NUMBER", []);
      const compiled = visitor.compile(new Nodes.Over(fn));
      expect(compiled).toBe("ROW_NUMBER() OVER ()");
    });

    // -- CTE --
    it("WITH clause", () => {
      const cte = users
        .project(users.get("name"))
        .where(users.get("age").gt(21));
      const alias = new Nodes.TableAlias(cte.ast, "adults");
      const cteAs = new Nodes.As(alias, cte.ast);

      const main = new SelectManager();
      main.with(cteAs);
      main.from("adults");
      main.project(sql("*"));
      const result = main.toSql();
      expect(result).toContain("WITH");
      expect(result).toContain('"adults"');
    });

    it("WITH RECURSIVE", () => {
      const cte = users.project(star);
      const alias = new Nodes.TableAlias(cte.ast, "tree");
      const cteAs = new Nodes.As(alias, cte.ast);

      const main = new SelectManager();
      main.withRecursive(cteAs);
      main.from("tree");
      main.project(sql("*"));
      expect(main.toSql()).toContain("WITH RECURSIVE");
    });

    // -- Subquery in comparison --
    it("attribute compared to subquery", () => {
      const avgQuery = users.project(users.get("karma").average());
      // Subquery as a node in a comparison
      expect(avgQuery.ast).toBeInstanceOf(Nodes.SelectStatement);
    });

    // -- attribute.count(true) with DISTINCT --
    it("attribute.count(true) generates COUNT(DISTINCT ...)", () => {
      expect(users.project(users.get("name").count(true)).toSql()).toBe(
        'SELECT COUNT(DISTINCT "users"."name") FROM "users"'
      );
    });

    // -- Lock with custom string --
    it("lock with custom clause", () => {
      expect(
        users.project(star).lock("FOR SHARE").toSql()
      ).toBe('SELECT * FROM "users" FOR SHARE');
    });

    // -- Casted node --
    it("Casted node renders the quoted value", () => {
      const visitor = new Visitors.ToSql();
      const attr = users.get("name");
      const casted = new Nodes.Casted("hello", attr);
      expect(visitor.compile(casted)).toBe("'hello'");
    });

    it("Casted node with number", () => {
      const visitor = new Visitors.ToSql();
      const attr = users.get("age");
      const casted = new Nodes.Casted(42, attr);
      expect(visitor.compile(casted)).toBe("42");
    });

    it("Casted node with null", () => {
      const visitor = new Visitors.ToSql();
      const attr = users.get("name");
      const casted = new Nodes.Casted(null, attr);
      expect(visitor.compile(casted)).toBe("NULL");
    });
  });

  // =========================================================================
  // Window framing
  // =========================================================================
  describe("Window framing", () => {
    const visitor = new Visitors.ToSql();

    it("ROWS UNBOUNDED PRECEDING", () => {
      const w = new Nodes.Window();
      w.order(users.get("id").asc());
      w.frame(new Nodes.Rows(new Nodes.Preceding()));
      const fn = new Nodes.NamedFunction("SUM", [users.get("amount")]);
      const result = visitor.compile(new Nodes.Over(fn, w));
      expect(result).toContain("ROWS UNBOUNDED PRECEDING");
    });

    it("ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING", () => {
      const w = new Nodes.Window();
      w.order(users.get("id").asc());
      w.frame(new Nodes.Rows(new Nodes.Between(
        new Nodes.CurrentRow(),
        new Nodes.Following()
      )));
      const fn = new Nodes.NamedFunction("SUM", [users.get("amount")]);
      const result = visitor.compile(new Nodes.Over(fn, w));
      expect(result).toContain("ROWS");
      expect(result).toContain("CURRENT ROW");
    });

    it("RANGE frame", () => {
      const w = new Nodes.Window();
      w.order(users.get("id").asc());
      w.frame(new Nodes.Range(new Nodes.Preceding()));
      const fn = new Nodes.NamedFunction("SUM", [users.get("amount")]);
      const result = visitor.compile(new Nodes.Over(fn, w));
      expect(result).toContain("RANGE UNBOUNDED PRECEDING");
    });

    it("Preceding with N rows", () => {
      const visitor = new Visitors.ToSql();
      const result = visitor.compile(new Nodes.Preceding(new Nodes.Quoted(3)));
      expect(result).toBe("3 PRECEDING");
    });

    it("Following with N rows", () => {
      const visitor = new Visitors.ToSql();
      const result = visitor.compile(new Nodes.Following(new Nodes.Quoted(5)));
      expect(result).toBe("5 FOLLOWING");
    });

    it("UNBOUNDED FOLLOWING", () => {
      const visitor = new Visitors.ToSql();
      const result = visitor.compile(new Nodes.Following());
      expect(result).toBe("UNBOUNDED FOLLOWING");
    });

    it("CurrentRow", () => {
      const visitor = new Visitors.ToSql();
      const result = visitor.compile(new Nodes.CurrentRow());
      expect(result).toBe("CURRENT ROW");
    });

    it("NamedWindow renders WINDOW name AS (...)", () => {
      const nw = new Nodes.NamedWindow("w");
      nw.order(users.get("id").asc());
      const result = visitor.compile(nw);
      expect(result).toBe('"w" AS (ORDER BY "users"."id" ASC)');
    });

    it("Window with partition and order", () => {
      const w = new Nodes.Window();
      w.partition(users.get("department_id"));
      w.order(users.get("salary").desc());
      const result = visitor.compile(w);
      expect(result).toBe('(PARTITION BY "users"."department_id" ORDER BY "users"."salary" DESC)');
    });
  });

  // =========================================================================
  // Additional join types
  // =========================================================================
  describe("Join types", () => {
    it("RIGHT OUTER JOIN", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      const onNode = new Nodes.On(users.get("id").eq(posts.get("user_id")));
      mgr.ast.cores[0].source.right.push(
        new Nodes.RightOuterJoin(posts, onNode)
      );
      expect(mgr.toSql()).toBe(
        'SELECT * FROM "users" RIGHT OUTER JOIN "posts" ON "users"."id" = "posts"."user_id"'
      );
    });

    it("FULL OUTER JOIN", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      const onNode = new Nodes.On(users.get("id").eq(posts.get("user_id")));
      mgr.ast.cores[0].source.right.push(
        new Nodes.FullOuterJoin(posts, onNode)
      );
      expect(mgr.toSql()).toBe(
        'SELECT * FROM "users" FULL OUTER JOIN "posts" ON "users"."id" = "posts"."user_id"'
      );
    });

    it("CROSS JOIN", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      mgr.ast.cores[0].source.right.push(new Nodes.CrossJoin(posts));
      expect(mgr.toSql()).toBe(
        'SELECT * FROM "users" CROSS JOIN "posts"'
      );
    });

    it("StringJoin (raw SQL join)", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      mgr.ast.cores[0].source.right.push(
        new Nodes.StringJoin(new Nodes.SqlLiteral('JOIN "posts" ON "posts"."user_id" = "users"."id"'))
      );
      expect(mgr.toSql()).toBe(
        'SELECT * FROM "users" JOIN "posts" ON "posts"."user_id" = "users"."id"'
      );
    });
  });

  // =========================================================================
  // _any / _all remaining variants
  // =========================================================================
  describe("Additional _any/_all variants", () => {
    it("notEqAny", () => {
      const result = users
        .project(star)
        .where(users.get("name").notEqAny(["dean", "sam"]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" != 'dean' OR "users"."name" != 'sam')`
      );
    });

    it("notEqAll", () => {
      const result = users
        .project(star)
        .where(users.get("name").notEqAll(["dean", "sam"]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" != 'dean' AND "users"."name" != 'sam')`
      );
    });

    it("gtAll", () => {
      const result = users
        .project(star)
        .where(users.get("age").gtAll([10, 20]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."age" > 10 AND "users"."age" > 20)`
      );
    });

    it("gteqAny", () => {
      const result = users
        .project(star)
        .where(users.get("age").gteqAny([10, 20]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."age" >= 10 OR "users"."age" >= 20)`
      );
    });

    it("gteqAll", () => {
      const result = users
        .project(star)
        .where(users.get("age").gteqAll([10, 20]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."age" >= 10 AND "users"."age" >= 20)`
      );
    });

    it("ltAny", () => {
      const result = users
        .project(star)
        .where(users.get("age").ltAny([10, 20]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."age" < 10 OR "users"."age" < 20)`
      );
    });

    it("lteqAny", () => {
      const result = users
        .project(star)
        .where(users.get("age").lteqAny([10, 20]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."age" <= 10 OR "users"."age" <= 20)`
      );
    });

    it("lteqAll", () => {
      const result = users
        .project(star)
        .where(users.get("age").lteqAll([10, 20]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."age" <= 10 AND "users"."age" <= 20)`
      );
    });

    it("matchesAll", () => {
      const result = users
        .project(star)
        .where(users.get("name").matchesAll(["%d%", "%e%"]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" LIKE '%d%' AND "users"."name" LIKE '%e%')`
      );
    });

    it("doesNotMatchAny", () => {
      const result = users
        .project(star)
        .where(users.get("name").doesNotMatchAny(["%d%", "%e%"]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" NOT LIKE '%d%' OR "users"."name" NOT LIKE '%e%')`
      );
    });

    it("doesNotMatchAll", () => {
      const result = users
        .project(star)
        .where(users.get("name").doesNotMatchAll(["%d%", "%e%"]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."name" NOT LIKE '%d%' AND "users"."name" NOT LIKE '%e%')`
      );
    });

    it("inAny", () => {
      const result = users
        .project(star)
        .where(users.get("id").inAny([[1, 2], [3, 4]]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."id" IN (1, 2) OR "users"."id" IN (3, 4))`
      );
    });

    it("inAll", () => {
      const result = users
        .project(star)
        .where(users.get("id").inAll([[1, 2], [3, 4]]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."id" IN (1, 2) AND "users"."id" IN (3, 4))`
      );
    });

    it("notInAny", () => {
      const result = users
        .project(star)
        .where(users.get("id").notInAny([[1, 2], [3, 4]]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."id" NOT IN (1, 2) OR "users"."id" NOT IN (3, 4))`
      );
    });

    it("notInAll", () => {
      const result = users
        .project(star)
        .where(users.get("id").notInAll([[1, 2], [3, 4]]))
        .toSql();
      expect(result).toBe(
        `SELECT * FROM "users" WHERE ("users"."id" NOT IN (1, 2) AND "users"."id" NOT IN (3, 4))`
      );
    });
  });

  // =========================================================================
  // Collectors
  // =========================================================================
  describe("Collectors", () => {
    it("Bind collector accumulates binds", () => {
      const bind = new Collectors.Bind();
      bind.append("SELECT * FROM users WHERE id = ");
      bind.addBind(42);
      bind.append(" AND name = ");
      bind.addBind("dean");
      const [sql, binds] = bind.value;
      expect(sql).toBe("SELECT * FROM users WHERE id = ? AND name = ?");
      expect(binds).toEqual([42, "dean"]);
    });

    it("SQLString collector accumulates SQL and binds", () => {
      const collector = new Collectors.SQLString();
      collector.append("SELECT ");
      collector.append("*");
      expect(collector.value).toBe("SELECT *");
    });

    it("SQLString addBind appends ? placeholder", () => {
      const collector = new Collectors.SQLString();
      collector.append("WHERE id = ");
      collector.addBind(42);
      expect(collector.value).toBe("WHERE id = ?");
      expect(collector.bindValues).toEqual([42]);
    });
  });

  // =========================================================================
  // DeleteManager with ORDER BY and LIMIT
  // =========================================================================
  describe("DeleteManager advanced", () => {
    it("DELETE with ORDER BY and LIMIT", () => {
      const mgr = new DeleteManager();
      mgr.from(users);
      mgr.where(users.get("active").eq(false));
      mgr.order(users.get("created_at").asc());
      mgr.take(10);
      expect(mgr.toSql()).toBe(
        'DELETE FROM "users" WHERE "users"."active" = FALSE ORDER BY "users"."created_at" ASC LIMIT 10'
      );
    });
  });

  // =========================================================================
  // UpdateManager with ORDER BY and LIMIT
  // =========================================================================
  describe("UpdateManager advanced", () => {
    it("UPDATE with ORDER BY and LIMIT", () => {
      const mgr = new UpdateManager();
      mgr.table(users);
      mgr.set([[users.get("active"), false]]);
      mgr.where(users.get("age").lt(18));
      mgr.order(users.get("name").asc());
      mgr.take(5);
      expect(mgr.toSql()).toBe(
        `UPDATE "users" SET "users"."active" = FALSE WHERE "users"."age" < 18 ORDER BY "users"."name" ASC LIMIT 5`
      );
    });
  });

  // =========================================================================
  // InsertManager.values()
  // =========================================================================
  describe("InsertManager advanced", () => {
    it("multi-row INSERT with ValuesList", () => {
      const mgr = new InsertManager();
      mgr.into(users);
      mgr.ast.columns = [users.get("name"), users.get("age")];
      mgr.values(new Nodes.ValuesList([
        [new Nodes.Quoted("dean"), new Nodes.Quoted(30)],
        [new Nodes.Quoted("sam"), new Nodes.Quoted(25)],
      ]));
      expect(mgr.toSql()).toBe(
        `INSERT INTO "users" ("name", "age") VALUES ('dean', 30), ('sam', 25)`
      );
    });
  });

  // =========================================================================
  // Table.from()
  // =========================================================================
  describe("Table.from()", () => {
    it("returns a SelectManager with the table as source", () => {
      const mgr = users.from();
      expect(mgr).toBeInstanceOf(SelectManager);
      mgr.project(star);
      expect(mgr.toSql()).toBe('SELECT * FROM "users"');
    });
  });

  // =========================================================================
  // SelectManager convenience join methods
  // =========================================================================
  describe("SelectManager join methods", () => {
    it("rightOuterJoin generates RIGHT OUTER JOIN", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      mgr.rightOuterJoin(posts, users.get("id").eq(posts.get("user_id")));
      expect(mgr.toSql()).toContain("RIGHT OUTER JOIN");
      expect(mgr.toSql()).toContain('"posts"');
    });

    it("fullOuterJoin generates FULL OUTER JOIN", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      mgr.fullOuterJoin(posts, users.get("id").eq(posts.get("user_id")));
      expect(mgr.toSql()).toContain("FULL OUTER JOIN");
    });

    it("crossJoin generates CROSS JOIN", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      mgr.crossJoin(posts);
      expect(mgr.toSql()).toContain("CROSS JOIN");
      expect(mgr.toSql()).toContain('"posts"');
    });

    it("window creates a named window", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      const win = mgr.window("w");
      win.order(users.get("created_at").asc());
      // The window should be in core.windows
      expect(mgr.toSql()).toContain("WINDOW");
    });

    it("rightOuterJoin with string table name", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      mgr.rightOuterJoin("posts");
      expect(mgr.toSql()).toContain("RIGHT OUTER JOIN");
    });

    it("fullOuterJoin with string table name", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      mgr.fullOuterJoin("posts");
      expect(mgr.toSql()).toContain("FULL OUTER JOIN");
    });

    it("crossJoin with string table name", () => {
      const mgr = new SelectManager(users);
      mgr.project(star);
      mgr.crossJoin("posts");
      expect(mgr.toSql()).toContain("CROSS JOIN");
    });
  });

  // -- Attribute convenience functions --
  describe("Attribute string/null functions", () => {
    it("lower() generates LOWER function", () => {
      const name = users.get("name");
      const fn = name.lower();
      const mgr = new SelectManager(users);
      mgr.project(fn);
      const sql = mgr.toSql();
      expect(sql).toContain("LOWER");
      expect(sql).toContain('"name"');
    });

    it("upper() generates UPPER function", () => {
      const name = users.get("name");
      const fn = name.upper();
      const mgr = new SelectManager(users);
      mgr.project(fn);
      const sql = mgr.toSql();
      expect(sql).toContain("UPPER");
    });

    it("coalesce() generates COALESCE function", () => {
      const name = users.get("name");
      const fn = name.coalesce("Unknown");
      const mgr = new SelectManager(users);
      mgr.project(fn);
      const sql = mgr.toSql();
      expect(sql).toContain("COALESCE");
      expect(sql).toContain("'Unknown'");
    });
  });

  describe("Case node", () => {
    it("generates simple CASE WHEN THEN END", () => {
      const caseNode = new Nodes.Case()
        .when(new Nodes.SqlLiteral("1 = 1"), new Nodes.SqlLiteral("'yes'"));
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(caseNode);
      expect(sql).toBe("CASE WHEN 1 = 1 THEN 'yes' END");
    });

    it("generates CASE with operand", () => {
      const status = users.get("status");
      const caseNode = new Nodes.Case(status)
        .when(new Nodes.Quoted(1), new Nodes.SqlLiteral("'active'"))
        .when(new Nodes.Quoted(2), new Nodes.SqlLiteral("'inactive'"));
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(caseNode);
      expect(sql).toContain('CASE "users"."status"');
      expect(sql).toContain("WHEN 1 THEN 'active'");
      expect(sql).toContain("WHEN 2 THEN 'inactive'");
      expect(sql).toContain("END");
    });

    it("generates CASE with ELSE", () => {
      const caseNode = new Nodes.Case()
        .when(new Nodes.SqlLiteral("x > 0"), new Nodes.SqlLiteral("'positive'"))
        .else(new Nodes.SqlLiteral("'non-positive'"));
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(caseNode);
      expect(sql).toBe("CASE WHEN x > 0 THEN 'positive' ELSE 'non-positive' END");
    });

    it("generates CASE with multiple conditions and else", () => {
      const caseNode = new Nodes.Case()
        .when(new Nodes.SqlLiteral("score >= 90"), new Nodes.SqlLiteral("'A'"))
        .when(new Nodes.SqlLiteral("score >= 80"), new Nodes.SqlLiteral("'B'"))
        .when(new Nodes.SqlLiteral("score >= 70"), new Nodes.SqlLiteral("'C'"))
        .else(new Nodes.SqlLiteral("'F'"));
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(caseNode);
      expect(sql).toBe(
        "CASE WHEN score >= 90 THEN 'A' WHEN score >= 80 THEN 'B' WHEN score >= 70 THEN 'C' ELSE 'F' END"
      );
    });

    it("supports string/number shorthand in when()", () => {
      const caseNode = new Nodes.Case()
        .when("active", 1)
        .when("inactive", 0);
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(caseNode);
      expect(sql).toBe("CASE WHEN active THEN 1 WHEN inactive THEN 0 END");
    });

    it("supports .as() for aliasing", () => {
      const caseNode = new Nodes.Case()
        .when(new Nodes.SqlLiteral("1 = 1"), new Nodes.SqlLiteral("'yes'"))
        .as("result");
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(caseNode);
      expect(sql).toBe("CASE WHEN 1 = 1 THEN 'yes' END AS result");
    });

    it("is immutable — chaining returns new instances", () => {
      const c1 = new Nodes.Case();
      const c2 = c1.when(new Nodes.SqlLiteral("a"), new Nodes.SqlLiteral("b"));
      const c3 = c2.else(new Nodes.SqlLiteral("c"));
      expect(c1.conditions.length).toBe(0);
      expect(c2.conditions.length).toBe(1);
      expect(c2.defaultValue).toBeNull();
      expect(c3.defaultValue).not.toBeNull();
    });
  });

  describe("Extract node", () => {
    it("generates EXTRACT(field FROM expr)", () => {
      const createdAt = users.get("created_at");
      const node = new Nodes.Extract(createdAt, "YEAR");
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(node);
      expect(sql).toBe('EXTRACT(YEAR FROM "users"."created_at")');
    });

    it("supports .as() aliasing", () => {
      const createdAt = users.get("created_at");
      const node = new Nodes.Extract(createdAt, "MONTH").as("birth_month");
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(node);
      expect(sql).toBe('EXTRACT(MONTH FROM "users"."created_at") AS birth_month');
    });

    it("works via attribute.extract()", () => {
      const createdAt = users.get("created_at");
      const node = createdAt.extract("DAY");
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(node);
      expect(sql).toBe('EXTRACT(DAY FROM "users"."created_at")');
    });
  });

  describe("InfixOperation node", () => {
    it("generates custom infix operation", () => {
      const a = users.get("age");
      const b = new Nodes.Quoted(10);
      const node = new Nodes.InfixOperation("||", a, b);
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(node);
      expect(sql).toBe('"users"."age" || 10');
    });

    it("supports .as() aliasing", () => {
      const first = users.get("first_name");
      const last = users.get("last_name");
      const node = new Nodes.InfixOperation("||", first, last).as("full_name");
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(node);
      expect(sql).toBe('"users"."first_name" || "users"."last_name" AS full_name');
    });
  });

  describe("BindParam node", () => {
    it("generates ? placeholder when no value", () => {
      const node = new Nodes.BindParam();
      const visitor = new Visitors.ToSql();
      expect(visitor.compile(node)).toBe("?");
    });

    it("generates quoted value when value provided", () => {
      const node = new Nodes.BindParam("hello");
      const visitor = new Visitors.ToSql();
      expect(visitor.compile(node)).toBe("'hello'");
    });

    it("generates number value", () => {
      const node = new Nodes.BindParam(42);
      const visitor = new Visitors.ToSql();
      expect(visitor.compile(node)).toBe("42");
    });
  });

  describe("Concat node", () => {
    it("generates SQL concatenation with ||", () => {
      const first = users.get("first_name");
      const last = users.get("last_name");
      const node = new Nodes.Concat(first, last);
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(node);
      expect(sql).toBe('"users"."first_name" || "users"."last_name"');
    });

    it("supports .as() aliasing", () => {
      const first = users.get("first_name");
      const space = new Nodes.Quoted(" ");
      const node = new Nodes.Concat(first, space).as("display_name");
      const visitor = new Visitors.ToSql();
      const sql = visitor.compile(node);
      expect(sql).toBe('"users"."first_name" || \' \' AS display_name');
    });
  });
});
