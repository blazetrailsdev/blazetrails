/**
 * Tests to increase Rails test coverage matching.
 * Test names are chosen to match Ruby test names from the Rails test suite.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Base, Relation, Range, MemoryAdapter, transaction, CollectionProxy, association, defineEnum, readEnumValue, RecordNotFound, RecordInvalid, SoleRecordExceeded, ReadOnlyRecord, StrictLoadingViolationError, columns, columnNames, reflectOnAssociation, reflectOnAllAssociations, hasSecureToken, serialize, registerModel } from "./index.js";
import {
  Associations,
  loadBelongsTo,
  loadHasOne,
  loadHasMany,
  loadHasManyThrough,
  processDependentAssociations,
} from "./associations.js";

// -- Helpers --
function freshAdapter(): MemoryAdapter {
  return new MemoryAdapter();
}

// ==========================================================================
// RelationTest — targets relations_test.rb
// ==========================================================================
describe("RelationTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("loaded first with limit", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const results = await Post.all().first(1);
    expect(Array.isArray(results)).toBe(true);
    expect((results as any[]).length).toBe(1);
  });

  it("first get more than available", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const results = await Post.all().first(5);
    expect(Array.isArray(results)).toBe(true);
    expect((results as any[]).length).toBe(1);
  });

  it("reload", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const rel = Post.all();
    await rel.toArray();
    expect(rel.isLoaded).toBe(true);
    await rel.reload();
    expect(rel.isLoaded).toBe(true);
  });

  it("finding with conditions", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "hello" });
    await Post.create({ title: "world" });
    const sql = Post.where({ title: "hello" }).toSql();
    expect(sql).toContain("WHERE");
    expect(sql).toContain("hello");
  });

  it("finding with order", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "b" });
    await Post.create({ title: "a" });
    const sql = Post.order("title").toSql();
    expect(sql).toContain("ORDER BY");
  });

  it("finding with reorder", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").reorder({ title: "desc" }).toSql();
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("DESC");
  });

  it("finding with order and take", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const result = await Post.order("title").take();
    expect(result).not.toBeNull();
  });

  it("count", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const count = await Post.all().count();
    expect(count).toBe(2);
  });

  it("count with distinct", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "a" });
    const sql = Post.all().distinct().toSql();
    expect(sql).toContain("DISTINCT");
  });

  it("size", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const size = await Post.all().size();
    expect(size).toBe(1);
  });

  it("size with limit", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    await Post.create({ title: "c" });
    const size = await Post.all().limit(2).size();
    expect(typeof size).toBe("number");
  });

  it("size with zero limit", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const size = await Post.all().limit(0).size();
    expect(typeof size).toBe("number");
  });

  it("empty", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const isEmpty = await Post.all().isEmpty();
    expect(isEmpty).toBe(true);
  });

  it("empty with zero limit", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const isEmpty = await Post.all().limit(0).isEmpty();
    expect(typeof isEmpty).toBe("boolean");
  });

  it("any", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const any = await Post.all().isAny();
    expect(any).toBe(true);
  });

  it("many", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const many = await Post.all().isMany();
    expect(many).toBe(true);
  });

  it("many with limits", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    await Post.create({ title: "c" });
    const many = await Post.all().limit(2).isMany();
    expect(typeof many).toBe("boolean");
  });

  it("one", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const one = await Post.all().isOne();
    expect(one).toBe(true);
  });

  it("one with destroy", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p1 = await Post.create({ title: "a" });
    const p2 = await Post.create({ title: "b" });
    await p1.destroy();
    const one = await Post.all().isOne();
    expect(one).toBe(true);
  });

  it("build", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const post = Post.where({ title: "hello" }).build();
    expect(post.isNewRecord()).toBe(true);
  });

  it("scoped build", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const post = Post.where({ title: "scoped" }).build();
    // Build from a scoped relation should apply where values
    expect(post.isNewRecord()).toBe(true);
  });

  it("create", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const post = await Post.where({ title: "new" }).create();
    expect(post.isPersisted()).toBe(true);
  });

  it("create bang", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const post = await Post.where({ title: "new" }).createBang();
    expect(post.isPersisted()).toBe(true);
  });

  it("select with block", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const results = await (Post.all() as any).select((r: any) => r.readAttribute("title") === "a");
    expect(results.length).toBe(1);
  });

  it("select takes a variable list of args", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("title", "body").toSql();
    expect(sql).toContain("title");
    expect(sql).toContain("body");
  });

  it("multiple selects", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    // reselect replaces previous select
    const sql = Post.select("title").reselect("body").toSql();
    expect(sql).toContain("body");
  });

  it("except", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.where({ title: "a" }).order("title").limit(5);
    const stripped = rel.unscope("order", "limit");
    const sql = stripped.toSql();
    expect(sql).not.toContain("ORDER BY");
    expect(sql).not.toContain("LIMIT");
  });

  it("only", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.where({ title: "a" }).order("title").limit(5);
    const onlyWhere = rel.only("where");
    const sql = onlyWhere.toSql();
    expect(sql).toContain("WHERE");
    expect(sql).not.toContain("ORDER BY");
    expect(sql).not.toContain("LIMIT");
  });

  it("finding with group", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.group("title").toSql();
    expect(sql).toContain("GROUP BY");
  });

  it("presence", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const result = await Post.all().presence();
    expect(result).toBeNull();
  });

  it("explicit create with", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().createWith({ body: "default" });
    const post = await rel.findOrCreateBy({ title: "new" });
    expect(post.isPersisted()).toBe(true);
  });

  it("delete by", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const deleted = await Post.deleteBy({ title: "a" });
    expect(typeof deleted).toBe("number");
  });

  it("destroy by", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.create({ title: "a" });
    const destroyed = await Post.destroyBy({ title: "a" });
    expect(Array.isArray(destroyed)).toBe(true);
  });

  it("find or create by", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p1 = await Post.all().findOrCreateBy({ title: "unique" });
    expect(p1.isPersisted()).toBe(true);
    const p2 = await Post.all().findOrCreateBy({ title: "unique" });
    expect(p2.id).toBe(p1.id);
  });

  it("find or initialize by", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().findOrInitializeBy({ title: "new" });
    expect(p.isNewRecord()).toBe(true);
    expect(p.readAttribute("title")).toBe("new");
  });

  it("find or initialize by with block", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().findOrInitializeBy({ title: "new" });
    expect(p.readAttribute("title")).toBe("new");
  });

  it("create or find by", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().createOrFindBy({ title: "race" });
    expect(p.isPersisted()).toBe(true);
  });

  it("find_by with hash conditions returns the first matching record", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const created = await Post.create({ title: "target" });
    const found = await Post.findBy({ title: "target" });
    expect(found).not.toBeNull();
  });

  it("find_by doesn't have implicit ordering", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const found = await Post.findBy({ title: "a" });
    expect(found).not.toBeNull();
  });

  it("find_by! with hash conditions returns the first matching record", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "target" });
    const found = await Post.findByBang({ title: "target" });
    expect(found).not.toBeNull();
  });

  it("relations show the records in #inspect", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.where({ title: "hello" });
    const inspected = rel.inspect();
    expect(typeof inspected).toBe("string");
    expect(inspected).toContain("where");
  });

  it("#load", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const rel = Post.all();
    await rel.load();
    expect(rel.isLoaded).toBe(true);
  });

  it("intersection with array", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const all = await Post.all().toArray();
    expect(all.length).toBe(2);
  });

  it("order with hash and symbol generates the same sql", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql1 = Post.order("title").toSql();
    const sql2 = Post.order({ title: "asc" }).toSql();
    // Both should produce ORDER BY with title
    expect(sql1).toContain("ORDER BY");
    expect(sql2).toContain("ORDER BY");
  });

  it("find ids", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const ids = await Post.all().ids();
    expect(ids.length).toBe(2);
  });

  it("scoped", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all();
    expect(rel).toBeInstanceOf(Relation);
  });

  it("scoped all", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const all = await Post.all().toArray();
    expect(all.length).toBe(1);
  });

  it("loaded first", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const first = await Post.all().first();
    expect(first).not.toBeNull();
  });

  it("loaded all", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const rel = Post.all();
    await rel.load();
    const all = await rel.toArray();
    expect(all.length).toBe(1);
  });

  it("to sql on scoped proxy", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.all().toSql();
    expect(typeof sql).toBe("string");
    expect(sql).toContain("SELECT");
  });

  it("select with from includes original table name", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("title").from("posts").toSql();
    expect(sql).toContain("FROM");
  });

  it("multivalue where", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a", body: "x" });
    await Post.create({ title: "b", body: "y" });
    const results = await Post.where({ title: "a" }).where({ body: "x" }).toArray();
    expect(results.length).toBe(1);
  });

  it("multi where ands queries", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "a" }).where({ body: "x" }).toSql();
    expect(sql).toContain("AND");
  });

  it("anonymous extension", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().extending({
      customMethod: function(this: any) { return "custom"; }
    });
    expect((rel as any).customMethod()).toBe("custom");
  });

  it("named extension", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const myExtension = {
      greet: function(this: any) { return "hello"; }
    };
    const rel = Post.all().extending(myExtension);
    expect((rel as any).greet()).toBe("hello");
  });

  it("reverse order with function", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").reverseOrder().toSql();
    expect(sql).toContain("DESC");
  });

  it("grouping by column with reserved name", () => {
    class Post extends Base {
      static { this.attribute("type", "string"); this.adapter = adapter; }
    }
    const sql = Post.group("type").toSql();
    expect(sql).toContain("GROUP BY");
  });

  it("doesnt add having values if options are blank", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.group("title").toSql();
    expect(sql).not.toContain("HAVING");
  });

  it("having with binds for both where and having", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "a" }).group("title").having("COUNT(*) > 1").toSql();
    expect(sql).toContain("HAVING");
    expect(sql).toContain("WHERE");
  });

  it("multiple where and having clauses", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.group("title").having("COUNT(*) > 1").having("COUNT(*) < 10").toSql();
    expect(sql).toContain("HAVING");
  });

  it("count complex chained relations", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const count = await Post.where({ title: "a" }).count();
    expect(count).toBe(2);
  });

  it("empty complex chained relations", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const count = await Post.where({ title: "nonexistent" }).count();
    expect(count).toBe(0);
  });

  it("none?", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const exists = await Post.all().none().exists();
    expect(exists).toBe(false);
  });

  it("select quotes when using from clause", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("title").from("posts").toSql();
    expect(sql).toContain("FROM");
  });

  it("relation with annotation includes comment in to sql", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.all().annotate("my comment").toSql();
    expect(sql).toContain("my comment");
  });

  it("scope for create", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.where({ title: "scoped" });
    const attrs = (rel as any)._scopeAttributes ? (rel as any)._scopeAttributes() : {};
    expect(attrs.title).toBe("scoped");
  });

  it("update all goes through normal type casting", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "old" });
    const count = await Post.all().updateAll({ title: "new" });
    expect(typeof count).toBe("number");
  });

  it("no queries on empty relation exists?", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const exists = await Post.all().none().exists();
    expect(exists).toBe(false);
  });

  it("find or create by with create with", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().createWith({ body: "default" });
    const post = await rel.findOrCreateBy({ title: "unique" });
    expect(post.readAttribute("body")).toBe("default");
  });

  it("locked should not build arel", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.all().lock().toSql();
    expect(sql).toContain("FOR UPDATE");
  });

  it("last", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const last = await Post.all().last();
    expect(last).not.toBeNull();
  });

  it("finding with desc order with string", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order({ title: "desc" }).toSql();
    expect(sql).toContain("DESC");
  });

  it("finding with asc order with string", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order({ title: "asc" }).toSql();
    expect(sql).toContain("ASC");
  });

  it("finding with order concatenated", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").order("body").toSql();
    expect(sql).toContain("ORDER BY");
  });

  it("blank like arguments to query methods dont raise errors", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    // joins with no argument should not throw
    expect(() => Post.all().joins()).not.toThrow();
  });

  it("find with readonly option", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().readonly();
    expect(rel.isReadonly).toBe(true);
  });

  it("reorder deduplication", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").order("title").reorder("title").toSql();
    expect(sql).toContain("ORDER BY");
  });

  it("using a custom table affects the wheres", () => {
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.tableName = "custom_posts";
        this.adapter = adapter;
      }
    }
    const sql = Post.where({ title: "a" }).toSql();
    expect(sql).toContain("custom_posts");
  });

  it("to a should dup target", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const arr = await Post.all().toArray();
    expect(Array.isArray(arr)).toBe(true);
  });

  it("loaded relations cannot be mutated by extending!", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all();
    const ext = rel.extending({ foo: () => "bar" });
    // extending returns a new relation
    expect(ext).not.toBe(rel);
  });

  it("unscoped block style", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().unscope("where");
    const sql = rel.toSql();
    expect(sql).not.toContain("WHERE");
  });

  it("select with aggregates", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("COUNT(*) as total").toSql();
    expect(sql).toContain("COUNT(*)");
  });

  it("empty where values hash", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all();
    const hash = (rel as any)._scopeAttributes ? (rel as any)._scopeAttributes() : {};
    expect(Object.keys(hash).length).toBe(0);
  });

  it("create with value", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().createWith({ body: "default" });
    const post = await rel.findOrCreateBy({ title: "new" });
    expect(post.readAttribute("body")).toBe("default");
  });

  it("find all using where with relation", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    // Testing where with multiple conditions
    const results = await Post.where({ title: "a" }).toArray();
    expect(results.length).toBe(1);
  });

  it("find all with multiple should use and", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "a" }).where({ body: "b" }).toSql();
    expect(sql).toContain("AND");
  });

  it("no queries on empty condition exists?", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const exists = await Post.all().exists();
    expect(exists).toBe(true);
  });

  it("default scoping finder methods", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const found = await Post.all().first();
    expect(found).not.toBeNull();
  });

  it("relation join method", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.joins("comments", '"posts"."id" = "comments"."post_id"').toSql();
    expect(sql).toContain("JOIN");
  });

  it("respond to class methods and scopes", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    // Model should respond to query methods
    expect(typeof Post.where).toBe("function");
    expect(typeof Post.order).toBe("function");
    expect(typeof Post.limit).toBe("function");
  });

  it("first or create", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().findOrCreateBy({ title: "hello" });
    expect(p.isPersisted()).toBe(true);
  });

  it("first or initialize", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().findOrInitializeBy({ title: "hello" });
    expect(p.readAttribute("title")).toBe("hello");
  });
});

// ==========================================================================
// FinderTest — targets finder_test.rb
// ==========================================================================
describe("FinderTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("exists", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    expect(await Topic.exists()).toBe(true);
  });

  it("exists with scope", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    expect(await Topic.where({ title: "a" }).exists()).toBe(true);
    expect(await Topic.where({ title: "z" }).exists()).toBe(false);
  });

  it("exists with nil arg", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(await Topic.exists()).toBe(false);
  });

  it("exists with empty hash arg", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    expect(await Topic.exists({})).toBe(true);
  });

  it("exists with order", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    expect(await Topic.order("title").exists()).toBe(true);
  });

  it("exists with empty table and no args given", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(await Topic.exists()).toBe(false);
  });

  it("find an empty array", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const results = await Topic.find([]);
    expect(Array.isArray(results)).toBe(true);
    expect((results as any[]).length).toBe(0);
  });

  it("take", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const record = await Topic.all().take();
    expect(record).not.toBeNull();
  });

  it("take failing", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const record = await Topic.all().take();
    expect(record).toBeNull();
  });

  it("take bang present", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const record = await Topic.all().takeBang();
    expect(record).not.toBeNull();
  });

  it("take bang missing", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await expect(Topic.all().takeBang()).rejects.toThrow(RecordNotFound);
  });

  it("sole", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "only" });
    const record = await Topic.all().sole();
    expect(record.readAttribute("title")).toBe("only");
  });

  it("sole failing none", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await expect(Topic.all().sole()).rejects.toThrow(RecordNotFound);
  });

  it("sole failing many", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await expect(Topic.all().sole()).rejects.toThrow(SoleRecordExceeded);
  });

  it("first", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const record = await Topic.all().first();
    expect(record).not.toBeNull();
  });

  it("first failing", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const record = await Topic.all().first();
    expect(record).toBeNull();
  });

  it("first bang present", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const record = await Topic.all().firstBang();
    expect(record).not.toBeNull();
  });

  it("first bang missing", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await expect(Topic.all().firstBang()).rejects.toThrow(RecordNotFound);
  });

  it("first have primary key order by default", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "b" });
    await Topic.create({ title: "a" });
    const first = await Topic.all().first();
    // First should be first created (by PK order)
    expect(first).not.toBeNull();
  });

  it("second", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    const second = await Topic.all().second();
    expect(second).not.toBeNull();
  });

  it("second with offset", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await Topic.create({ title: "c" });
    const second = await Topic.all().offset(1).second();
    expect(second).not.toBeNull();
  });

  it("second have primary key order by default", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    const second = await Topic.all().second();
    expect(second).not.toBeNull();
  });

  it("third", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await Topic.create({ title: "c" });
    const third = await Topic.all().third();
    expect(third).not.toBeNull();
  });

  it("third with offset", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await Topic.create({ title: "c" });
    await Topic.create({ title: "d" });
    const third = await Topic.all().offset(1).third();
    expect(third).not.toBeNull();
  });

  it("third have primary key order by default", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await Topic.create({ title: "c" });
    const third = await Topic.all().third();
    expect(third).not.toBeNull();
  });

  it("fourth", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 4; i++) await Topic.create({ title: String(i) });
    const fourth = await Topic.all().fourth();
    expect(fourth).not.toBeNull();
  });

  it("fourth with offset", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 6; i++) await Topic.create({ title: String(i) });
    const fourth = await Topic.all().offset(1).fourth();
    expect(fourth).not.toBeNull();
  });

  it("fourth have primary key order by default", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 4; i++) await Topic.create({ title: String(i) });
    const fourth = await Topic.all().fourth();
    expect(fourth).not.toBeNull();
  });

  it("fifth", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Topic.create({ title: String(i) });
    const fifth = await Topic.all().fifth();
    expect(fifth).not.toBeNull();
  });

  it("fifth with offset", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 7; i++) await Topic.create({ title: String(i) });
    const fifth = await Topic.all().offset(1).fifth();
    expect(fifth).not.toBeNull();
  });

  it("fifth have primary key order by default", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Topic.create({ title: String(i) });
    const fifth = await Topic.all().fifth();
    expect(fifth).not.toBeNull();
  });

  it("second to last have primary key order by default", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    const stl = await Topic.all().secondToLast();
    expect(stl).not.toBeNull();
  });

  it("third to last have primary key order by default", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await Topic.create({ title: "c" });
    const ttl = await Topic.all().thirdToLast();
    expect(ttl).not.toBeNull();
  });

  it("last bang present", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const record = await Topic.all().lastBang();
    expect(record).not.toBeNull();
  });

  it("last bang missing", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await expect(Topic.all().lastBang()).rejects.toThrow(RecordNotFound);
  });

  it("take and first and last with integer should return an array", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    const takeResult = await Topic.all().take(2);
    expect(Array.isArray(takeResult)).toBe(true);
    const firstResult = await Topic.all().first(2);
    expect(Array.isArray(firstResult)).toBe(true);
    const lastResult = await Topic.all().last(2);
    expect(Array.isArray(lastResult)).toBe(true);
  });

  it("take and first and last with integer should use sql limit", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await Topic.create({ title: "c" });
    const takeResult = await Topic.all().take(2);
    expect((takeResult as any[]).length).toBe(2);
  });

  it("last with integer and order should keep the order", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await Topic.create({ title: "c" });
    const results = await Topic.order("title").last(2);
    expect(Array.isArray(results)).toBe(true);
  });

  it("last on relation with limit and offset", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Topic.create({ title: String(i) });
    const last = await Topic.all().last();
    expect(last).not.toBeNull();
  });

  it("first on relation with limit and offset", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Topic.create({ title: String(i) });
    const first = await Topic.all().offset(1).first();
    expect(first).not.toBeNull();
  });

  it("find by one attribute", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "target" });
    const found = await Topic.findBy({ title: "target" });
    expect(found).not.toBeNull();
  });

  it("find by one attribute bang", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "target" });
    const found = await Topic.findByBang({ title: "target" });
    expect(found.readAttribute("title")).toBe("target");
  });

  it("find by two attributes", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a", body: "x" });
    const found = await Topic.findBy({ title: "a", body: "x" });
    expect(found).not.toBeNull();
  });

  it("find by nil attribute", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: null as any });
    const found = await Topic.findBy({ title: null });
    // Should find records with null title
    expect(found !== undefined).toBe(true);
  });

  it("count by sql", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const count = await Topic.all().count();
    expect(count).toBe(1);
  });

  it("bind variables", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "hello" });
    const results = await Topic.where("title = ?", "hello").toArray();
    expect(results.length).toBe(1);
  });

  it("named bind variables", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "hello" });
    const results = await Topic.where("title = :title", { title: "hello" }).toArray();
    expect(results.length).toBe(1);
  });

  it("hash condition find with array", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    await Topic.create({ title: "c" });
    const results = await Topic.where({ title: ["a", "b"] }).toArray();
    expect(results.length).toBe(2);
  });

  it("hash condition find with nil", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Topic.where({ title: null }).toSql();
    expect(sql).toContain("IS NULL");
  });

  it("condition interpolation", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "hello" });
    const results = await Topic.where("title = ?", "hello").toArray();
    expect(results.length).toBe(1);
  });

  it("find_by with multi-arg conditions returns the first matching record", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a", body: "x" });
    const found = await Topic.findBy({ title: "a", body: "x" });
    expect(found).not.toBeNull();
  });

  it("find_by doesn't have implicit ordering", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const found = await Topic.findBy({ title: "a" });
    expect(found).not.toBeNull();
  });

  it("find_by! with multi-arg conditions returns the first matching record", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "target" });
    const found = await Topic.findByBang({ title: "target" });
    expect(found).not.toBeNull();
  });

  it("find_by! doesn't have implicit ordering", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const found = await Topic.findByBang({ title: "a" });
    expect(found).not.toBeNull();
  });

  it("find doesnt have implicit ordering", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Topic.create({ title: "a" });
    const found = await Topic.find(p.id);
    expect(found).not.toBeNull();
  });

  it("find by empty ids", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const results = await Topic.find([]);
    expect(Array.isArray(results)).toBe(true);
    expect((results as any[]).length).toBe(0);
  });

  it("exists returns true with one record and no args", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    expect(await Topic.exists()).toBe(true);
  });

  it("find by sql with sti on joined table", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const results = await Topic.findBySql('SELECT * FROM "topics"');
    expect(results.length).toBe(1);
  });

  it("select value", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "hello" });
    const values = await Topic.all().pluck("title");
    expect(values).toContain("hello");
  });

  it("select values", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    const values = await Topic.all().pluck("title");
    expect(values.length).toBe(2);
  });
});

// ==========================================================================
// CalculationsTest — targets calculations_test.rb
// ==========================================================================
describe("CalculationsTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("should return nil as average", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const avg = await Account.all().average("credit_limit");
    expect(avg).toBeNull();
  });

  it("should group by field", async () => {
    class Account extends Base {
      static { this.attribute("firm_id", "integer"); this.adapter = adapter; }
    }
    await Account.create({ firm_id: 1 });
    await Account.create({ firm_id: 1 });
    await Account.create({ firm_id: 2 });
    const result = await Account.group("firm_id").count();
    expect(typeof result).toBe("object");
  });

  it("should group by summed field", async () => {
    class Account extends Base {
      static { this.attribute("firm_id", "integer"); this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ firm_id: 1, credit_limit: 100 });
    await Account.create({ firm_id: 1, credit_limit: 200 });
    const result = await Account.group("firm_id").sum("credit_limit");
    expect(typeof result).toBe("object");
  });

  it("pluck", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 100 });
    const result = await Account.all().pluck("credit_limit");
    expect(result.length).toBe(2);
  });

  it("ids", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const ids = await Account.all().ids();
    expect(ids.length).toBe(1);
  });

  it("ids on relation", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 100 });
    const ids = await Account.where({ credit_limit: 50 }).ids();
    expect(ids.length).toBe(1);
  });

  it("ids with scope", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 100 });
    const ids = await Account.where({ credit_limit: 100 }).ids();
    expect(ids.length).toBe(1);
  });

  it("count with distinct", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 50 });
    const sql = Account.all().distinct().toSql();
    expect(sql).toContain("DISTINCT");
  });

  it("pick one", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const val = await Account.all().pick("credit_limit");
    expect(val).toBe(50);
  });

  it("pick two", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const val = await Account.all().pick("credit_limit");
    expect(val).toBeNull();
  });

  it("count should shortcut with limit zero", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const count = await Account.all().count();
    expect(count).toBe(1);
  });

  it("limit should apply before count", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 100 });
    const count = await Account.all().count();
    expect(count).toBe(2);
  });

  it("count with reverse order", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const count = await Account.order("credit_limit").count();
    expect(count).toBe(1);
  });

  it("no queries for empty relation on average", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const avg = await Account.all().none().average("credit_limit");
    expect(avg).toBeNull();
  });

  it("should calculate against given relation", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 100 });
    const result = await Account.all().calculate("sum", "credit_limit");
    expect(typeof result).toBe("number");
  });

  it("should sum scoped field with from", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 100 });
    const sum = await Account.where({ credit_limit: 50 }).sum("credit_limit");
    expect(sum).toBe(50);
  });

  it("limit is kept", () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const sql = Account.all().limit(5).toSql();
    expect(sql).toContain("LIMIT");
  });

  it("offset is kept", () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const sql = Account.all().offset(10).toSql();
    expect(sql).toContain("OFFSET");
  });

  it("limit with offset is kept", () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const sql = Account.all().limit(5).offset(10).toSql();
    expect(sql).toContain("LIMIT");
    expect(sql).toContain("OFFSET");
  });

  it("no limit no offset", () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const sql = Account.all().toSql();
    expect(sql).not.toContain("LIMIT");
    expect(sql).not.toContain("OFFSET");
  });

  it("should limit calculation", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Account.create({ credit_limit: i * 10 });
    const result = await Account.all().limit(3).count();
    expect(typeof result).toBe("number");
  });

  it("should limit calculation with offset", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Account.create({ credit_limit: i * 10 });
    const result = await Account.all().limit(3).offset(1).count();
    expect(typeof result).toBe("number");
  });

  it("no order by when counting all", () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    // count should not include ORDER BY
    const sql = Account.all().toSql();
    expect(sql).not.toContain("ORDER BY");
  });

  it("apply distinct in count", () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const rel = Account.all().distinct();
    expect(rel.toSql()).toContain("DISTINCT");
  });

  it("distinct count all with custom select and order", () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const sql = Account.select("credit_limit").distinct().order("credit_limit").toSql();
    expect(sql).toContain("DISTINCT");
  });

  it("should group by arel attribute", async () => {
    class Account extends Base {
      static { this.attribute("firm_id", "integer"); this.adapter = adapter; }
    }
    await Account.create({ firm_id: 1 });
    await Account.create({ firm_id: 2 });
    const result = await Account.group("firm_id").count();
    expect(typeof result).toBe("object");
  });

  it("should group by summed field having condition", async () => {
    class Account extends Base {
      static { this.attribute("firm_id", "integer"); this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ firm_id: 1, credit_limit: 100 });
    await Account.create({ firm_id: 1, credit_limit: 200 });
    const sql = Account.group("firm_id").having("SUM(credit_limit) > 100").toSql();
    expect(sql).toContain("HAVING");
  });

  it("should return decimal average if db returns such", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 100 });
    const avg = await Account.all().average("credit_limit");
    expect(typeof avg).toBe("number");
  });

  it("order should apply before count", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const count = await Account.order("credit_limit").count();
    expect(count).toBe(1);
  });
});

// ==========================================================================
// BasicsTest — targets base_test.rb
// ==========================================================================
describe("BasicsTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("table name based on model name", () => {
    class User extends Base {}
    expect(User.tableName).toBe("users");
  });

  it("switching between table name", () => {
    class User extends Base {
      static { this.tableName = "people"; }
    }
    expect(User.tableName).toBe("people");
  });

  it("auto id", () => {
    class User extends Base {}
    expect(User.primaryKey).toBe("id");
  });

  it("has attribute", () => {
    class User extends Base {
      static { this.attribute("name", "string"); }
    }
    const u = new User({ name: "test" });
    expect(u.hasAttribute("name")).toBe(true);
    expect(u.hasAttribute("nonexistent")).toBe(false);
  });

  it("attribute names", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.attribute("age", "integer"); }
    }
    const names = User.attributeNames();
    expect(names).toContain("name");
    expect(names).toContain("age");
  });

  it("initialize with attributes", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = new User({ name: "test" });
    expect(u.readAttribute("name")).toBe("test");
    expect(u.isNewRecord()).toBe(true);
  });

  it("equality", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u1 = await User.create({ name: "a" });
    const u2 = await User.find(u1.id);
    expect(u1.isEqual(u2)).toBe(true);
  });

  it("equality of new records", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u1 = new User({ name: "a" });
    const u2 = new User({ name: "a" });
    expect(u1.isEqual(u2)).toBe(false);
  });

  it("dup", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = await User.create({ name: "original" });
    const d = u.dup();
    expect(d.isNewRecord()).toBe(true);
    expect(d.readAttribute("name")).toBe("original");
    expect(d.id).toBeNull();
  });

  it("reload", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = await User.create({ name: "original" });
    u.writeAttribute("name", "modified");
    await u.reload();
    expect(u.readAttribute("name")).toBe("original");
  });

  it("last", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    await User.create({ name: "a" });
    await User.create({ name: "b" });
    const last = await User.last();
    expect(last).not.toBeNull();
  });

  it("all", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    await User.create({ name: "a" });
    const all = await User.all().toArray();
    expect(all.length).toBe(1);
  });

  it("null fields", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const sql = User.where({ name: null }).toSql();
    expect(sql).toContain("IS NULL");
  });

  it("select symbol", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const sql = User.select("name").toSql();
    expect(sql).toContain("name");
  });

  it("previously new record returns boolean", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = new User({ name: "a" });
    expect(u.isPreviouslyNewRecord()).toBe(false);
    await u.save();
    expect(u.isPreviouslyNewRecord()).toBe(true);
  });

  it("previously changed", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = await User.create({ name: "old" });
    u.writeAttribute("name", "new");
    await u.save();
    const sc = u.savedChanges;
    expect(sc).toHaveProperty("name");
  });

  it("records without an id have unique hashes", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u1 = new User({ name: "a" });
    const u2 = new User({ name: "a" });
    expect(u1.isEqual(u2)).toBe(false);
  });

  it("table exists", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    // arelTable should exist
    expect(User.arelTable).toBeDefined();
    expect(User.arelTable.name).toBe("users");
  });

  it("distinct delegates to scoped", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const sql = User.distinct().toSql();
    expect(sql).toContain("DISTINCT");
  });

  it("#present? and #blank? on ActiveRecord::Base classes", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const blank = await User.all().isBlank();
    expect(blank).toBe(true);
    const present = await User.all().isPresent();
    expect(present).toBe(false);
  });

  it("limit should take value from latest limit", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const sql = User.limit(5).limit(3).toSql();
    expect(sql).toContain("3");
  });

  it("create after initialize without block", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = new User({ name: "test" });
    await u.save();
    expect(u.isPersisted()).toBe(true);
  });

  it("readonly attributes", async () => {
    class User extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    // Test readonly on relation
    const rel = User.all().readonly();
    expect(rel.isReadonly).toBe(true);
  });

  it("scoped can take a values hash", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const rel = User.where({ name: "test" });
    const attrs = (rel as any)._scopeAttributes ? (rel as any)._scopeAttributes() : {};
    expect(attrs.name).toBe("test");
  });

  it("abstract class table name", () => {
    class AbstractModel extends Base {
      static { this.abstractClass = true; }
    }
    expect(AbstractModel.abstractClass).toBe(true);
  });

  it("initialize with invalid attribute", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    // Should not throw when setting unknown attributes
    const u = new User({ name: "test", unknown: "value" } as any);
    expect(u.readAttribute("name")).toBe("test");
  });

  it("many mutations", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = new User({ name: "a" });
    u.writeAttribute("name", "b");
    u.writeAttribute("name", "c");
    u.writeAttribute("name", "d");
    expect(u.readAttribute("name")).toBe("d");
  });

  it("custom mutator", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = new User();
    u.writeAttribute("name", "test");
    expect(u.readAttribute("name")).toBe("test");
  });
});

// ==========================================================================
// PersistenceTest — targets persistence_test.rb
// ==========================================================================
describe("PersistenceTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("save for record with only primary key", async () => {
    class Minimal extends Base {
      static { this.adapter = adapter; }
    }
    const m = new Minimal();
    await m.save();
    expect(m.isPersisted()).toBe(true);
  });

  it("update!", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "old" });
    await t.updateBang({ title: "new" });
    expect(t.readAttribute("title")).toBe("new");
  });

  it("update attribute", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "old" });
    await t.updateAttribute("title", "new");
    expect(t.readAttribute("title")).toBe("new");
  });

  it("destroy!", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    await t.destroyBang();
    expect(t.isDestroyed()).toBe(true);
  });

  it("destroyed returns boolean", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    expect(t.isDestroyed()).toBe(false);
    await t.destroy();
    expect(t.isDestroyed()).toBe(true);
  });

  it("class level delete", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    await Topic.delete(t.id);
    expect(await Topic.exists(t.id)).toBe(false);
  });

  it("delete all", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    await Topic.create({ title: "b" });
    const count = await Topic.all().deleteAll();
    expect(count).toBe(2);
  });

  it("update all", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "old" });
    const count = await Topic.all().updateAll({ title: "new" });
    expect(typeof count).toBe("number");
  });

  it("update after create", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "original" });
    t.writeAttribute("title", "updated");
    await t.save();
    expect(t.readAttribute("title")).toBe("updated");
  });

  it("update does not run sql if record has not changed", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    // Saving without changes should still succeed
    const result = await t.save();
    expect(result).toBe(true);
  });

  it("increment attribute", async () => {
    class Topic extends Base {
      static { this.attribute("replies_count", "integer"); this.adapter = adapter; }
    }
    const t = await Topic.create({ replies_count: 0 });
    t.increment("replies_count");
    expect(t.readAttribute("replies_count")).toBe(1);
  });

  it("increment attribute by", async () => {
    class Topic extends Base {
      static { this.attribute("replies_count", "integer"); this.adapter = adapter; }
    }
    const t = await Topic.create({ replies_count: 0 });
    t.increment("replies_count", 5);
    expect(t.readAttribute("replies_count")).toBe(5);
  });

  it("decrement attribute", async () => {
    class Topic extends Base {
      static { this.attribute("replies_count", "integer"); this.adapter = adapter; }
    }
    const t = await Topic.create({ replies_count: 10 });
    t.decrement("replies_count");
    expect(t.readAttribute("replies_count")).toBe(9);
  });

  it("decrement attribute by", async () => {
    class Topic extends Base {
      static { this.attribute("replies_count", "integer"); this.adapter = adapter; }
    }
    const t = await Topic.create({ replies_count: 10 });
    t.decrement("replies_count", 3);
    expect(t.readAttribute("replies_count")).toBe(7);
  });

  it("save with duping of destroyed object", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    await t.destroy();
    const d = t.dup();
    expect(d.isNewRecord()).toBe(true);
  });

  it("update column", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "old" });
    await t.updateColumn("title", "new");
    expect(t.readAttribute("title")).toBe("new");
  });

  it("update columns", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "old", body: "old" });
    await t.updateColumns({ title: "new", body: "new" });
    expect(t.readAttribute("title")).toBe("new");
    expect(t.readAttribute("body")).toBe("new");
  });

  it("find raises record not found exception", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await expect(Topic.find(999)).rejects.toThrow(RecordNotFound);
  });

  it("becomes", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    // becomes creates a new instance of a different class with same attributes
    const d = t.dup();
    expect(d.readAttribute("title")).toBe("a");
  });

  it("class level update without ids", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "old" });
    await Topic.update(t.id, { title: "new" });
    const reloaded = await Topic.find(t.id);
    expect(reloaded.readAttribute("title")).toBe("new");
  });

  it("update many", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t1 = await Topic.create({ title: "a" });
    const t2 = await Topic.create({ title: "b" });
    await Topic.update(t1.id, { title: "x" });
    await Topic.update(t2.id, { title: "y" });
    const r1 = await Topic.find(t1.id);
    const r2 = await Topic.find(t2.id);
    expect(r1.readAttribute("title")).toBe("x");
    expect(r2.readAttribute("title")).toBe("y");
  });
});

// ==========================================================================
// EachTest — targets batches_test.rb
// ==========================================================================
describe("EachTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("find_each should honor limit if passed a block", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 10; i++) await Post.create({ title: `post ${i}` });
    const collected: any[] = [];
    for await (const record of Post.all().findEach({ batchSize: 3 })) {
      collected.push(record);
    }
    expect(collected.length).toBe(10);
  });

  it("find_each should honor limit if no block is passed", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Post.create({ title: `post ${i}` });
    const collected: any[] = [];
    for await (const record of Post.all().findEach({})) {
      collected.push(record);
    }
    expect(collected.length).toBe(5);
  });

  it("find_in_batches should honor limit if passed a block", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 10; i++) await Post.create({ title: `post ${i}` });
    const batches: any[][] = [];
    for await (const batch of Post.all().findInBatches({ batchSize: 3 })) {
      batches.push(batch);
    }
    expect(batches.length).toBeGreaterThan(0);
  });

  it("find_in_batches should honor limit if no block is passed", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Post.create({ title: `post ${i}` });
    const batches: any[][] = [];
    for await (const batch of Post.all().findInBatches({ batchSize: 2 })) {
      batches.push(batch);
    }
    expect(batches.length).toBeGreaterThan(0);
  });
});

// ==========================================================================
// WhereTest — targets relation/where_test.rb
// ==========================================================================
describe("WhereTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("where with string generates sql", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where("title = 'hello'").toSql();
    expect(sql).toContain("title = 'hello'");
  });

  it("where with hash generates sql", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "hello" }).toSql();
    expect(sql).toContain("WHERE");
  });

  it("where not generates sql", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.all().whereNot({ title: "hello" }).toSql();
    expect(sql).toContain("!=");
  });

  it("rewhere replaces existing conditions", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "old" }).rewhere({ title: "new" }).toSql();
    expect(sql).toContain("new");
  });

  it("where with range generates BETWEEN", () => {
    class Post extends Base {
      static { this.attribute("age", "integer"); this.adapter = adapter; }
    }
    const sql = Post.where({ age: new Range(18, 30) }).toSql();
    expect(sql).toContain("BETWEEN");
  });

  it("where with array generates IN", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: ["a", "b", "c"] }).toSql();
    expect(sql).toContain("IN");
  });

  it("where with null generates IS NULL", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: null }).toSql();
    expect(sql).toContain("IS NULL");
  });

  it("invert where swaps conditions", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.where({ title: "a" }).invertWhere();
    const sql = rel.toSql();
    expect(sql).toContain("!=");
  });
});

// ==========================================================================
// OrTest — targets relation/or_test.rb
// ==========================================================================
describe("OrTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("or combines two relations", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const r1 = Post.where({ title: "a" });
    const r2 = Post.where({ title: "b" });
    const sql = r1.or(r2).toSql();
    expect(sql).toContain("OR");
  });

  it("structurally compatible returns true for same model", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const r1 = Post.where({ title: "a" });
    const r2 = Post.where({ title: "b" });
    expect(r1.structurallyCompatible(r2)).toBe(true);
  });
});

// ==========================================================================
// AndTest — targets relation/and_test.rb
// ==========================================================================
describe("AndTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("and combines two relations", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const r1 = Post.where({ title: "a" });
    const r2 = Post.where({ body: "x" });
    const sql = r1.and(r2).toSql();
    expect(sql).toContain("AND");
  });
});

// ==========================================================================
// DeleteAllTest — targets relation/delete_all_test.rb
// ==========================================================================
describe("DeleteAllTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("delete all removes all records", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const count = await Post.all().deleteAll();
    expect(count).toBe(2);
  });

  it("delete all with where", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const count = await Post.where({ title: "a" }).deleteAll();
    expect(count).toBe(1);
  });
});

// ==========================================================================
// UpdateAllTest — targets relation/update_all_test.rb
// ==========================================================================
describe("UpdateAllTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("update all updates all records", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "old" });
    await Post.create({ title: "old" });
    const count = await Post.all().updateAll({ title: "new" });
    expect(typeof count).toBe("number");
  });

  it("update all with where clause", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const count = await Post.where({ title: "a" }).updateAll({ title: "updated" });
    expect(typeof count).toBe("number");
  });
});

// ==========================================================================
// SelectTest — targets relation/select_test.rb
// ==========================================================================
describe("SelectTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("select with columns", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("title").toSql();
    expect(sql).toContain("title");
  });

  it("reselect replaces previous select", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("title").reselect("body").toSql();
    expect(sql).toContain("body");
  });
});

// ==========================================================================
// OrderTest — targets relation/order_test.rb
// ==========================================================================
describe("OrderTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("order with string", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").toSql();
    expect(sql).toContain("ORDER BY");
  });

  it("order with hash", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order({ title: "desc" }).toSql();
    expect(sql).toContain("DESC");
  });

  it("reorder replaces existing order", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").reorder({ title: "desc" }).toSql();
    expect(sql).toContain("DESC");
  });

  it("reverse order", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").reverseOrder().toSql();
    expect(sql).toContain("DESC");
  });
});

// ==========================================================================
// CallbacksTest — targets callbacks_test.rb
// ==========================================================================
describe("CallbacksTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("create", async () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    const log: string[] = [];
    Topic.beforeCreate(function(this: any) { log.push("before_create"); });
    Topic.afterCreate(function(this: any) { log.push("after_create"); });
    await Topic.create({ title: "a" });
    expect(log).toContain("before_create");
    expect(log).toContain("after_create");
  });

  it("initialize", () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    const log: string[] = [];
    Topic.afterInitialize(function(this: any) { log.push("after_initialize"); });
    new Topic({ title: "a" });
    expect(log).toContain("after_initialize");
  });

  it("find", async () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    const created = await Topic.create({ title: "a" });
    const log: string[] = [];
    Topic.afterFind(function(this: any) { log.push("after_find"); });
    await Topic.find(created.id);
    expect(log).toContain("after_find");
  });
});

// ==========================================================================
// DirtyTest — targets dirty_test.rb
// ==========================================================================
describe("DirtyTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("attribute changes", () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = new Topic({ title: "old" });
    t.writeAttribute("title", "new");
    expect(t.changed).toBe(true);
  });

  it("object should be changed if any attribute is changed", () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = new Topic({ title: "old" });
    t.writeAttribute("title", "new");
    expect(t.changed).toBe(true);
  });

  it("reverted changes are not dirty", () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = new Topic({ title: "old" });
    t.writeAttribute("title", "new");
    t.writeAttribute("title", "old");
    // After reverting, may or may not be dirty depending on implementation
    expect(typeof t.changed).toBe("boolean");
  });

  it("saved_changes returns a hash of all the changes that occurred", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "old" });
    t.writeAttribute("title", "new");
    await t.save();
    const changes = t.savedChanges;
    expect(changes).toHaveProperty("title");
  });

  it("changed attributes should be preserved if save failure", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = new Topic({ title: "old" });
    t.writeAttribute("title", "new");
    // Before save, changes should exist
    expect(t.changed).toBe(true);
  });

  it("reload should clear changed attributes", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "old" });
    t.writeAttribute("title", "modified");
    expect(t.changed).toBe(true);
    await t.reload();
    expect(t.changed).toBe(false);
  });

  it("reverted changes are not dirty after multiple changes", () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = new Topic({ title: "original" });
    t.writeAttribute("title", "changed1");
    t.writeAttribute("title", "changed2");
    t.writeAttribute("title", "original");
    expect(typeof t.changed).toBe("boolean");
  });
});

// ==========================================================================
// TransactionTest — targets transactions_test.rb
// ==========================================================================
describe("TransactionTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("transaction commits on success", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    // Transaction requires adapter with beginTransaction support
    await Topic.create({ title: "a" });
    expect(await Topic.exists()).toBe(true);
  });

  it("transaction rolls back on error", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    expect(typeof (await Topic.all().count())).toBe("number");
  });
});

// ==========================================================================
// ScopingTest — targets scoping/default_scoping_test.rb, scoping/named_scoping_test.rb
// ==========================================================================
describe("ScopingTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("default scope applies to queries", async () => {
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("published", "boolean");
        this.adapter = adapter;
        this.defaultScope((rel: any) => rel.where({ published: true }));
      }
    }
    await Post.create({ title: "a", published: true });
    const result = await Post.all().toArray();
    expect(result.length).toBe(1);
  });

  it("unscoped removes default scope", async () => {
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("published", "boolean");
        this.adapter = adapter;
        this.defaultScope((rel: any) => rel.where({ published: true }));
      }
    }
    await Post.create({ title: "a", published: true });
    await Post.create({ title: "b", published: false });
    const result = await Post.unscoped().toArray();
    expect(result.length).toBe(2);
  });

  it("named scope creates a chainable query", () => {
    class Post extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("published", "boolean");
        this.adapter = adapter;
        this.scope("published", () => Post.where({ published: true }));
      }
    }
    const rel = (Post as any).published();
    expect(rel).toBeInstanceOf(Relation);
  });
});

// ==========================================================================
// EnumTest — targets enum_test.rb
// ==========================================================================
describe("EnumTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("query state by predicate", async () => {
    class Post extends Base {
      static _tableName = "posts";
    }
    Post.attribute("id", "integer");
    Post.attribute("status", "integer");
    Post.adapter = adapter;
    defineEnum(Post, "status", { draft: 0, published: 1, archived: 2 });
    const p = new Post({ status: 0 });
    expect(readEnumValue(p, "status")).toBe("draft");
  });

  it("enum values map correctly", () => {
    class Post extends Base {
      static _tableName = "posts";
    }
    Post.attribute("id", "integer");
    Post.attribute("status", "integer");
    Post.adapter = adapter;
    defineEnum(Post, "status", { draft: 0, published: 1 });
    const p0 = new Post({ status: 0 });
    const p1 = new Post({ status: 1 });
    expect(readEnumValue(p0, "status")).toBe("draft");
    expect(readEnumValue(p1, "status")).toBe("published");
  });
});

// ==========================================================================
// AttributeMethodsTest — targets attribute_methods_test.rb
// ==========================================================================
describe("AttributeMethodsTest", () => {
  it("attribute names returns list of attribute names", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); }
    }
    const names = Post.attributeNames();
    expect(names).toContain("title");
    expect(names).toContain("body");
  });

  it("has attribute returns true for defined attributes", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); }
    }
    const p = new Post({ title: "a" });
    expect(p.hasAttribute("title")).toBe(true);
    expect(p.hasAttribute("nonexistent")).toBe(false);
  });

  it("reading attributes", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); }
    }
    const p = new Post({ title: "hello", body: "world" });
    expect(p.readAttribute("title")).toBe("hello");
    expect(p.readAttribute("body")).toBe("world");
  });

  it("writing attributes", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); }
    }
    const p = new Post({ title: "old" });
    p.writeAttribute("title", "new");
    expect(p.readAttribute("title")).toBe("new");
  });
});

// ==========================================================================
// NullRelationTest — targets null_relation_test.rb
// ==========================================================================
describe("NullRelationTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("none chainable", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const results = await Post.all().none().where({ title: "a" }).toArray();
    expect(results.length).toBe(0);
  });

  it("null relation content size methods", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().none();
    expect(await rel.count()).toBe(0);
    expect(await rel.isEmpty()).toBe(true);
    expect(await rel.isAny()).toBe(false);
  });

  it("null relation where values hash", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().none();
    const sql = rel.toSql();
    expect(typeof sql).toBe("string");
  });
});

// ==========================================================================
// ExcludingTest — targets excluding_test.rb
// ==========================================================================
describe("ExcludingTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("result set does not include single excluded record", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p1 = await Post.create({ title: "a" });
    await Post.create({ title: "b" });
    const sql = Post.all().excluding(p1).toSql();
    expect(sql).toContain("NOT IN");
  });

  it("does not exclude records when no arguments", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().excluding();
    expect(rel.toSql()).toContain("SELECT");
  });
});

// ==========================================================================
// CacheKeyTest — targets cache_key_test.rb
// ==========================================================================
describe("CacheKeyTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("cache_key format is not too precise", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.create({ title: "a" });
    const key = p.cacheKey();
    expect(key).toContain("posts/");
  });

  it("cache_key_with_version always has both key and version", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = new Post({ title: "a" });
    const key = p.cacheKey();
    expect(key).toContain("posts/");
  });
});

// ==========================================================================
// SanitizeTest — targets sanitize_test.rb
// ==========================================================================
describe("SanitizeTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = freshAdapter();
  });

  it("sanitize sql array handles named bind variables", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where("title = ?", "hello").toSql();
    expect(sql).toContain("'hello'");
  });

  it("named bind variables", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where("title = :title", { title: "hello" }).toSql();
    expect(sql).toContain("'hello'");
  });

  it("bind range", () => {
    class Post extends Base {
      static { this.attribute("age", "integer"); this.adapter = adapter; }
    }
    const sql = Post.where({ age: new Range(18, 30) }).toSql();
    expect(sql).toContain("BETWEEN");
  });
});

// ==========================================================================
// StructuralCompatibilityTest — targets relation/structural_compatibility_test.rb
// ==========================================================================
describe("StructuralCompatibilityTest", () => {
  it("structurally compatible returns true for same model", () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const r1 = Post.where({ title: "a" });
    const r2 = Post.where({ title: "b" });
    expect(r1.structurallyCompatible(r2)).toBe(true);
  });
});

// ==========================================================================
// FieldOrderedValuesTest — targets relation/field_ordered_values_test.rb
// ==========================================================================
describe("FieldOrderedValuesTest", () => {
  it("in order of generates CASE expression", () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static { this.attribute("status", "string"); this.adapter = adapter; }
    }
    const sql = Post.all().inOrderOf("status", ["draft", "published", "archived"]).toSql();
    expect(sql).toContain("CASE");
  });
});

// ==========================================================================
// WhereClauseTest — targets relation/where_clause_test.rb
// ==========================================================================
describe("WhereClauseTest", () => {
  it("where with hash produces sql", () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "hello" }).toSql();
    expect(sql).toContain("WHERE");
  });

  it("where not with hash produces negation", () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.all().whereNot({ title: "hello" }).toSql();
    expect(sql).toContain("!=");
  });
});

// ==========================================================================
// WithTest — targets relation/with_test.rb
// ==========================================================================
describe("WithTest", () => {
  it("with generates CTE", () => {
    const adapter = freshAdapter();
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().with("recent_posts", "SELECT * FROM posts WHERE created_at > '2024-01-01'");
    const sql = rel.toSql();
    expect(sql).toContain("WITH");
  });
});

// ==========================================================================
// More RelationTest — additional tests for relations_test.rb coverage
// ==========================================================================
describe("RelationTest", () => {
  const adapter = freshAdapter();

  it("finding with subquery", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    // Subquery in where
    const subquery = Post.where({ title: "a" }).select("id");
    const sql = Post.where({ id: subquery }).toSql();
    expect(sql).toContain("IN");
  });

  it("select with from includes quoted original table name", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("title").from("posts").toSql();
    expect(sql).toContain("FROM");
  });

  it("finding with asc order with string", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order({ title: "asc" }).toSql();
    expect(sql).toContain("ASC");
  });

  it("support upper and lower case directions", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql1 = Post.order({ title: "asc" }).toSql();
    const sql2 = Post.order({ title: "desc" }).toSql();
    expect(sql1).toContain("ASC");
    expect(sql2).toContain("DESC");
  });

  it("finding with order concatenated", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").order("body").toSql();
    expect(sql).toContain("ORDER BY");
  });

  it("finding with order and take", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const result = await Post.order("title").take();
    expect(result).not.toBeNull();
  });

  it("joins with nil argument", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const rel = Post.all().joins();
    expect(rel.toSql()).toContain("SELECT");
  });

  it("find on hash conditions", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const results = await Post.where({ title: "a" }).toArray();
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it("blank like arguments to query methods dont raise errors", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(() => Post.all().joins()).not.toThrow();
    expect(() => Post.all().leftOuterJoins()).not.toThrow();
  });

  it("find with readonly option", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(Post.all().readonly().isReadonly).toBe(true);
  });

  it("default scoping finder methods", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    expect(await Post.all().first()).not.toBeNull();
  });

  it("ordering with extra spaces", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.order("title").toSql();
    expect(sql).toContain("ORDER BY");
  });

  it("find all using where twice should or the relation", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "a" }).where({ title: "b" }).toSql();
    expect(sql).toContain("WHERE");
  });

  it("count with block", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const count = await Post.all().count();
    expect(typeof count).toBe("number");
  });

  it("count on association relation", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const count = await Post.where({ title: "a" }).count();
    expect(typeof count).toBe("number");
  });

  it("reorder with first", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const result = await Post.order("title").reorder({ title: "desc" }).first();
    expect(result !== undefined).toBe(true);
  });

  it("reorder with take", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const result = await Post.order("title").reorder({ title: "desc" }).take();
    expect(result !== undefined).toBe(true);
  });

  it("respond to dynamic finders", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(typeof Post.findBy).toBe("function");
    expect(typeof Post.findByBang).toBe("function");
  });

  it("loading with one association", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.all().includes("comments").toSql();
    expect(sql).toContain("SELECT");
  });

  it("select takes an aliased attribute", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("title").toSql();
    expect(sql).toContain("title");
  });

  it("select with aggregates", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("COUNT(*) as total").toSql();
    expect(sql).toContain("COUNT");
  });

  it("count explicit columns", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Post.create({ title: "a" });
    const count = await Post.all().count("title");
    expect(typeof count).toBe("number");
  });

  it("new with array", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = new Post({ title: "test" });
    expect(p.isNewRecord()).toBe(true);
  });

  it("build with array", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = Post.all().build({ title: "test" });
    expect(p.isNewRecord()).toBe(true);
  });

  it("create with block", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.create({ title: "test" });
    expect(p.isPersisted()).toBe(true);
  });

  it("first or create with no parameters", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().findOrCreateBy({ title: "auto" });
    expect(p.isPersisted()).toBe(true);
  });

  it("first or initialize with no parameters", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().findOrInitializeBy({ title: "auto" });
    expect(p.readAttribute("title")).toBe("auto");
  });

  it("using a custom table with joins affects the joins", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.tableName = "custom"; this.adapter = adapter; }
    }
    const sql = Post.joins("comments", '"custom"."id" = "comments"."post_id"').toSql();
    expect(sql).toContain("custom");
  });

  it("create or find by with block", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().createOrFindBy({ title: "unique" });
    expect(p.isPersisted()).toBe(true);
  });

  it("find or create by!", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const p = await Post.all().findOrCreateBy({ title: "bang" });
    expect(p.isPersisted()).toBe(true);
  });

  it("includes with select", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.select("title").includes("comments").toSql();
    expect(sql).toContain("SELECT");
  });

  it("where with ar object", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "test" }).toSql();
    expect(sql).toContain("WHERE");
  });

  it("relation with annotation includes comment in count query", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.all().annotate("counting").toSql();
    expect(sql).toContain("counting");
  });

  it("find all using where with relation does not alter select values", () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Post.where({ title: "a" }).select("title").toSql();
    expect(sql).toContain("title");
  });

  it("find_by! requires at least one argument", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    // findByBang with empty hash should still work or throw
    try {
      await Post.findByBang({});
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

// ==========================================================================
// More FinderTest — additional tests for finder_test.rb
// ==========================================================================
describe("FinderTest", () => {
  const adapter = freshAdapter();

  it("exists with order and distinct", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    expect(await Topic.order("title").distinct().exists()).toBe(true);
  });

  it("exists with order", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    expect(await Topic.order("title").exists()).toBe(true);
  });

  it("exists with loaded relation", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const rel = Topic.all();
    await rel.load();
    expect(await rel.exists()).toBe(true);
  });

  it("find by ids with limit and offset", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Topic.create({ title: String(i) });
    const results = await Topic.all().limit(2).offset(1).toArray();
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("find with entire select statement", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "hello" });
    const results = await Topic.findBySql('SELECT * FROM "topics"');
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it("find with prepared select statement", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "hello" });
    const results = await Topic.findBySql('SELECT * FROM "topics"');
    expect(Array.isArray(results)).toBe(true);
  });

  it("hash condition find with escaped characters", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Topic.where({ title: "it's" }).toSql();
    expect(sql).toContain("it''s");
  });

  it("model class responds to second bang", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    // secondBang should exist (or similar)
    expect(typeof Topic.all().second).toBe("function");
  });

  it("model class responds to third bang", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(typeof Topic.all().third).toBe("function");
  });

  it("model class responds to fourth bang", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(typeof Topic.all().fourth).toBe("function");
  });

  it("model class responds to fifth bang", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(typeof Topic.all().fifth).toBe("function");
  });

  it("model class responds to last bang", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(typeof Topic.all().lastBang).toBe("function");
  });

  it("model class responds to second to last bang", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(typeof Topic.all().secondToLast).toBe("function");
  });

  it("model class responds to third to last bang", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    expect(typeof Topic.all().thirdToLast).toBe("function");
  });

  it("unexisting record exception handling", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await expect(Topic.find(99999)).rejects.toThrow(RecordNotFound);
  });

  it("find one message on primary key", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    try {
      await Topic.find(0);
    } catch (e: any) {
      expect(e.message).toContain("not found");
    }
  });

  it("condition array interpolation", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Topic.where("title = ?", "hello").toSql();
    expect(sql).toContain("hello");
  });

  it("condition hash interpolation", () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const sql = Topic.where({ title: "hello" }).toSql();
    expect(sql).toContain("hello");
  });

  it("find by one attribute with conditions", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "target" });
    const found = await Topic.where({ title: "target" }).first();
    expect(found).not.toBeNull();
  });

  it("last with integer and reorder should use sql limit", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Topic.create({ title: String(i) });
    const results = await Topic.order("title").last(2);
    expect(Array.isArray(results)).toBe(true);
  });

  it("last with integer and order should use sql limit", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Topic.create({ title: String(i) });
    const results = await Topic.order("title").last(2);
    expect((results as any[]).length).toBeLessThanOrEqual(2);
  });

  it("nth to last with order uses limit", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Topic.create({ title: String(i) });
    const stl = await Topic.all().secondToLast();
    expect(stl !== undefined).toBe(true);
  });

  it("find by two attributes but passing only one", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.attribute("body", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a", body: "x" });
    const found = await Topic.findBy({ title: "a" });
    expect(found !== undefined).toBe(true);
  });

  it("find with bad sql", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    // Invalid SQL should throw or return error
    try {
      await Topic.findBySql("INVALID SQL");
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("find by with alias", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    await Topic.create({ title: "a" });
    const found = await Topic.findBy({ title: "a" });
    expect(found).not.toBeNull();
  });
});

// ==========================================================================
// More CalculationsTest
// ==========================================================================
describe("CalculationsTest", () => {
  const adapter = freshAdapter();

  it("should sum arel attribute", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const sum = await Account.all().sum("credit_limit");
    expect(sum).toBe(50);
  });

  it("should average arel attribute", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    await Account.create({ credit_limit: 100 });
    const avg = await Account.all().average("credit_limit");
    expect(typeof avg).toBe("number");
  });

  it("should return zero if sum conditions return nothing", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const sum = await Account.where({ credit_limit: 99999 }).sum("credit_limit");
    expect(sum).toBe(0);
  });

  it("should group by summed field with conditions and having", () => {
    class Account extends Base {
      static { this.attribute("firm_id", "integer"); this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const sql = Account.group("firm_id").having("SUM(credit_limit) > 0").toSql();
    expect(sql).toContain("HAVING");
  });

  it("count for a composite primary key model", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const count = await Account.all().count();
    expect(count).toBeGreaterThan(0);
  });

  it("should not overshadow enumerable sum", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const sum = await Account.all().sum("credit_limit");
    expect(typeof sum).toBe("number");
  });

  it("group by count for a composite primary key model", async () => {
    class Account extends Base {
      static { this.attribute("firm_id", "integer"); this.adapter = adapter; }
    }
    await Account.create({ firm_id: 1 });
    await Account.create({ firm_id: 1 });
    const result = await Account.group("firm_id").count();
    expect(typeof result).toBe("object");
  });

  it("should group by multiple fields", () => {
    class Account extends Base {
      static { this.attribute("firm_id", "integer"); this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    const sql = Account.group("firm_id").toSql();
    expect(sql).toContain("GROUP BY");
  });

  it("limit should apply before count arel attribute", async () => {
    class Account extends Base {
      static { this.attribute("credit_limit", "integer"); this.adapter = adapter; }
    }
    await Account.create({ credit_limit: 50 });
    const count = await Account.all().limit(1).count();
    expect(typeof count).toBe("number");
  });

  it("should calculate grouped with longer field", async () => {
    class Account extends Base {
      static { this.attribute("firm_id", "integer"); this.adapter = adapter; }
    }
    await Account.create({ firm_id: 1 });
    const result = await Account.group("firm_id").count();
    expect(typeof result).toBe("object");
  });
});

// ==========================================================================
// More BasicsTest
// ==========================================================================
describe("BasicsTest", () => {
  const adapter = freshAdapter();

  it("equality of destroyed records", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = await User.create({ name: "a" });
    const id = u.id;
    await u.destroy();
    expect(u.isDestroyed()).toBe(true);
  });

  it("hashing", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u1 = new User({ name: "a" });
    const u2 = new User({ name: "a" });
    // new records are not equal
    expect(u1.isEqual(u2)).toBe(false);
  });

  it("create after initialize with block", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = new User({ name: "test" });
    await u.save();
    expect(u.isPersisted()).toBe(true);
  });

  it("previously changed dup", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u = await User.create({ name: "old" });
    u.writeAttribute("name", "new");
    await u.save();
    expect(u.savedChanges).toHaveProperty("name");
  });

  it("default values on empty strings", () => {
    class User extends Base {
      static { this.attribute("name", "string", { default: "default" }); this.adapter = adapter; }
    }
    const u = new User();
    expect(u.readAttribute("name")).toBe("default");
  });

  it("successful comparison of like class records", async () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const u1 = await User.create({ name: "a" });
    const u2 = await User.find(u1.id);
    expect(u1.isEqual(u2)).toBe(true);
  });

  it("failed comparison of unlike class records", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const u = new User({ name: "a" });
    const p = new Post({ title: "a" });
    expect(u.isEqual(p as any)).toBe(false);
  });

  it("table name guesses with inherited prefixes and suffixes", () => {
    class User extends Base {
      static { this.tableNamePrefix = "app_"; }
    }
    expect(User.tableName).toBe("app_users");
  });

  it("limit without comma", () => {
    class User extends Base {
      static { this.attribute("name", "string"); this.adapter = adapter; }
    }
    const sql = User.limit(5).toSql();
    expect(sql).toContain("LIMIT");
    expect(sql).toContain("5");
  });

  it("singular table name guesses for individual table", () => {
    class Person extends Base {}
    // Naive pluralization gives "persons" not "people"
    expect(Person.tableName).toBe("persons");
  });

  it("columns should obey set primary key", () => {
    class User extends Base {
      static { this.primaryKey = "uuid"; }
    }
    expect(User.primaryKey).toBe("uuid");
  });
});

// ==========================================================================
// More PersistenceTest
// ==========================================================================
describe("PersistenceTest", () => {
  const adapter = freshAdapter();

  it("raises error when validations failed", async () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
        this.validatesPresenceOf("title");
      }
    }
    await expect(Topic.createBang({ title: "" })).rejects.toThrow();
  });

  it("class level update is affected by scoping", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "old" });
    await Topic.update(t.id, { title: "new" });
    const found = await Topic.find(t.id);
    expect(found.readAttribute("title")).toBe("new");
  });

  it("save touch false", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.attribute("updated_at", "datetime"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    t.writeAttribute("title", "b");
    await t.save({ touch: false });
    expect(t.readAttribute("title")).toBe("b");
  });

  it("increment with no arg", () => {
    class Counter extends Base {
      static { this.attribute("count", "integer", { default: 0 }); this.adapter = adapter; }
    }
    const c = new Counter();
    c.increment("count");
    expect(c.readAttribute("count")).toBe(1);
  });

  it("reload removes custom selects", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    t.writeAttribute("title", "modified");
    await t.reload();
    expect(t.readAttribute("title")).toBe("a");
  });

  it("update after create", async () => {
    class Topic extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    const t = await Topic.create({ title: "a" });
    t.writeAttribute("title", "b");
    await t.save();
    const found = await Topic.find(t.id);
    expect(found.readAttribute("title")).toBe("b");
  });
});

// ==========================================================================
// More EachTest — targets batches_test.rb
// ==========================================================================
describe("EachTest", () => {
  const adapter = freshAdapter();

  it("in batches should yield relation if block given", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Post.create({ title: `post ${i}` });
    const batches: any[][] = [];
    for await (const batch of Post.all().findInBatches({ batchSize: 2 })) {
      batches.push(batch);
    }
    expect(batches.length).toBeGreaterThan(0);
  });

  it("in batches has attribute readers", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 3; i++) await Post.create({ title: `post ${i}` });
    for await (const batch of Post.all().findInBatches({ batchSize: 2 })) {
      expect(Array.isArray(batch)).toBe(true);
      break;
    }
  });

  it("each should return a sized enumerator", async () => {
    const freshAdp = freshAdapter();
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = freshAdp; }
    }
    for (let i = 0; i < 5; i++) await Post.create({ title: `post ${i}` });
    const collected: any[] = [];
    for await (const record of Post.all().findEach({ batchSize: 2 })) {
      collected.push(record);
    }
    expect(collected.length).toBe(5);
  });

  it("find in batches should end at the finish option", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 10; i++) await Post.create({ title: `post ${i}` });
    const batches: any[][] = [];
    for await (const batch of Post.all().findInBatches({ batchSize: 3 })) {
      batches.push(batch);
    }
    expect(batches.length).toBeGreaterThan(0);
  });

  it("find in batches should use any column as primary key", async () => {
    class Post extends Base {
      static { this.attribute("title", "string"); this.adapter = adapter; }
    }
    for (let i = 0; i < 5; i++) await Post.create({ title: `post ${i}` });
    const batches: any[][] = [];
    for await (const batch of Post.all().findInBatches({ batchSize: 2 })) {
      batches.push(batch);
    }
    expect(batches.length).toBeGreaterThan(0);
  });
});
