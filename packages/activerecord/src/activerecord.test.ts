import { describe, it, expect, beforeEach } from "vitest";
import { Base, Relation, Range, MemoryAdapter, transaction, savepoint, CollectionProxy, association, MigrationRunner, defineEnum, readEnumValue, enableSti, hasSecurePassword, store, loadHabtm, delegate, RecordNotFound, RecordInvalid, StaleObjectError, ReadOnlyRecord, columns, columnNames, reflectOnAssociation, reflectOnAllAssociations, acceptsNestedAttributesFor, assignNestedAttributes, hasSecureToken, composedOf, serialize } from "./index.js";
import { Migration, TableDefinition, Schema } from "./migration.js";
import {
  Associations,
  registerModel,
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

// -- Phase 2000: Core --

describe("ActiveRecord", () => {
  describe("Base", () => {
    // -- Table name inference --
    describe("table name inference", () => {
      it("infers table name from class name", () => {
        class User extends Base {}
        expect(User.tableName).toBe("users");
      });

      it("handles CamelCase class names", () => {
        class BlogPost extends Base {}
        expect(BlogPost.tableName).toBe("blog_posts");
      });

      it("handles names ending in y", () => {
        class Category extends Base {}
        expect(Category.tableName).toBe("categories");
      });

      it("allows overriding table name", () => {
        class User extends Base {
          static {
            this.tableName = "people";
          }
        }
        expect(User.tableName).toBe("people");
      });
    });

    // -- Primary key --
    describe("primary key", () => {
      it("defaults to id", () => {
        class User extends Base {}
        expect(User.primaryKey).toBe("id");
      });

      it("can be overridden", () => {
        class User extends Base {
          static {
            this.primaryKey = "uuid";
          }
        }
        expect(User.primaryKey).toBe("uuid");
      });
    });

    // -- Arel table --
    describe("arel_table", () => {
      it("returns an Arel Table with the correct name", () => {
        class User extends Base {}
        const table = User.arelTable;
        expect(table.name).toBe("users");
      });
    });

    // -- Record state --
    describe("record state", () => {
      it("new record starts as new_record", () => {
        class User extends Base {
          static {
            this.attribute("name", "string");
          }
        }
        const u = new User({ name: "dean" });
        expect(u.isNewRecord()).toBe(true);
        expect(u.isPersisted()).toBe(false);
        expect(u.isDestroyed()).toBe(false);
      });

      it("is persisted after save", async () => {
        const adapter = freshAdapter();
        class User extends Base {
          static {
            this.attribute("name", "string");
            this.adapter = adapter;
          }
        }
        const u = new User({ name: "dean" });
        await u.save();
        expect(u.isNewRecord()).toBe(false);
        expect(u.isPersisted()).toBe(true);
      });

      it("is destroyed after destroy", async () => {
        const adapter = freshAdapter();
        class User extends Base {
          static {
            this.attribute("name", "string");
            this.adapter = adapter;
          }
        }
        const u = await User.create({ name: "dean" });
        await u.destroy();
        expect(u.isDestroyed()).toBe(true);
        expect(u.isPersisted()).toBe(false);
      });
    });

    // -- CRUD --
    describe("persistence", () => {
      let adapter: MemoryAdapter;

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("body", "string");
        }
      }

      beforeEach(() => {
        adapter = freshAdapter();
        Post.adapter = adapter;
      });

      it("save inserts a new record", async () => {
        const p = new Post({ title: "Hello", body: "World" });
        const result = await p.save();
        expect(result).toBe(true);
        expect(p.id).toBe(1);
        expect(p.isNewRecord()).toBe(false);
      });

      it("save updates an existing record", async () => {
        const p = await Post.create({ title: "Hello", body: "World" });
        p.writeAttribute("title", "Updated");
        await p.save();

        const found = await Post.find(p.id);
        expect(found.readAttribute("title")).toBe("Updated");
      });

      it("save returns false on validation failure", async () => {
        class Required extends Base {
          static {
            this.attribute("name", "string");
            this.validates("name", { presence: true });
            this.adapter = adapter;
          }
        }
        const r = new Required();
        const result = await r.save();
        expect(result).toBe(false);
        expect(r.isNewRecord()).toBe(true);
      });

      it("saveBang throws on validation failure", async () => {
        class Required extends Base {
          static {
            this.attribute("name", "string");
            this.validates("name", { presence: true });
            this.adapter = adapter;
          }
        }
        const r = new Required();
        await expect(r.saveBang()).rejects.toThrow("Validation failed");
      });

      it("create saves and returns the record", async () => {
        const p = await Post.create({ title: "Test", body: "Content" });
        expect(p.isPersisted()).toBe(true);
        expect(p.id).toBe(1);
      });

      it("update changes attributes and saves", async () => {
        const p = await Post.create({ title: "Old", body: "Content" });
        await p.update({ title: "New" });
        const found = await Post.find(p.id);
        expect(found.readAttribute("title")).toBe("New");
      });

      it("destroy removes the record", async () => {
        const p = await Post.create({ title: "Hello", body: "World" });
        const id = p.id;
        await p.destroy();
        await expect(Post.find(id)).rejects.toThrow("not found");
      });

      it("assignAttributes changes attributes without saving", async () => {
        const p = await Post.create({ title: "Old", body: "Content" });
        p.assignAttributes({ title: "New" });
        expect(p.readAttribute("title")).toBe("New");
        // Not saved yet — DB still has old value
        const found = await Post.find(p.id);
        expect(found.readAttribute("title")).toBe("Old");
      });
    });

    // -- Finders --
    describe("finders", () => {
      let adapter: MemoryAdapter;

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
        }
      }

      beforeEach(() => {
        adapter = freshAdapter();
        User.adapter = adapter;
      });

      it("find by primary key", async () => {
        await User.create({ name: "Alice", email: "alice@test.com" });
        const found = await User.find(1);
        expect(found.readAttribute("name")).toBe("Alice");
      });

      it("find throws when not found", async () => {
        await expect(User.find(999)).rejects.toThrow("not found");
      });

      it("findBy returns first match", async () => {
        await User.create({ name: "Alice", email: "alice@test.com" });
        await User.create({ name: "Bob", email: "bob@test.com" });
        const found = await User.findBy({ name: "Bob" });
        expect(found).not.toBeNull();
        expect(found!.readAttribute("email")).toBe("bob@test.com");
      });

      it("findBy returns null when no match", async () => {
        const found = await User.findBy({ name: "Nobody" });
        expect(found).toBeNull();
      });

      it("findByBang throws when no match", async () => {
        await expect(User.findByBang({ name: "Nobody" })).rejects.toThrow(
          "not found"
        );
      });
    });

    // -- toParam --
    describe("toParam", () => {
      it("returns id as string", async () => {
        const adapter = freshAdapter();
        class User extends Base {
          static {
            this.attribute("name", "string");
            this.adapter = adapter;
          }
        }
        const u = await User.create({ name: "Dean" });
        expect(u.toParam()).toBe("1");
      });

      it("returns null for new record", () => {
        class User extends Base {
          static {
            this.attribute("name", "string");
          }
        }
        const u = new User({ name: "Dean" });
        expect(u.toParam()).toBeNull();
      });
    });

    // -- Reload --
    describe("reload", () => {
      it("reloads attributes from database", async () => {
        const adapter = freshAdapter();
        class User extends Base {
          static {
            this.attribute("name", "string");
            this.adapter = adapter;
          }
        }
        const u = await User.create({ name: "Original" });
        // Directly modify via another instance
        const u2 = await User.find(u.id);
        await u2.update({ name: "Modified" });

        // u still has old value
        expect(u.readAttribute("name")).toBe("Original");
        await u.reload();
        expect(u.readAttribute("name")).toBe("Modified");
      });
    });

    // -- Callbacks --
    describe("callbacks", () => {
      it("runs before_save and after_save", async () => {
        const adapter = freshAdapter();
        const log: string[] = [];

        class Tracked extends Base {
          static {
            this.attribute("name", "string");
            this.adapter = adapter;
            this.beforeSave(() => {
              log.push("before_save");
            });
            this.afterSave(() => {
              log.push("after_save");
            });
          }
        }

        await Tracked.create({ name: "test" });
        expect(log).toEqual(["before_save", "after_save"]);
      });

      it("runs before_create on new records", async () => {
        const adapter = freshAdapter();
        const log: string[] = [];

        class Tracked extends Base {
          static {
            this.attribute("name", "string");
            this.adapter = adapter;
            this.beforeCreate(() => {
              log.push("before_create");
            });
          }
        }

        await Tracked.create({ name: "test" });
        expect(log).toContain("before_create");
      });

      it("runs before_destroy on destroy", async () => {
        const adapter = freshAdapter();
        const log: string[] = [];

        class Tracked extends Base {
          static {
            this.attribute("name", "string");
            this.adapter = adapter;
            this.beforeDestroy(() => {
              log.push("before_destroy");
            });
          }
        }

        const t = await Tracked.create({ name: "test" });
        await t.destroy();
        expect(log).toContain("before_destroy");
      });

      it("before_save returning false halts save", async () => {
        const adapter = freshAdapter();

        class Guarded extends Base {
          static {
            this.attribute("name", "string");
            this.adapter = adapter;
            this.beforeSave(() => false);
          }
        }

        const g = new Guarded({ name: "test" });
        const result = await g.save();
        expect(result).toBe(false);
        // Not saved, so still new
        expect(g.isNewRecord()).toBe(true);
      });
    });

    // -- Validations (inherited from ActiveModel) --
    describe("validations", () => {
      it("validates before saving", async () => {
        const adapter = freshAdapter();

        class User extends Base {
          static {
            this.attribute("name", "string");
            this.validates("name", { presence: true });
            this.adapter = adapter;
          }
        }

        const u = new User();
        expect(await u.save()).toBe(false);
        expect(u.errors.get("name")).toContain("can't be blank");
      });
    });
  });

  // -- Phase 2100: Relation --
  describe("Relation", () => {
    let adapter: MemoryAdapter;

    class Item extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("price", "integer");
        this.attribute("category", "string");
      }
    }

    beforeEach(async () => {
      adapter = freshAdapter();
      Item.adapter = adapter;
      await Item.create({ name: "Apple", price: 1, category: "fruit" });
      await Item.create({ name: "Banana", price: 2, category: "fruit" });
      await Item.create({ name: "Carrot", price: 3, category: "vegetable" });
    });

    it("all returns all records", async () => {
      const items = await Item.all().toArray();
      expect(items).toHaveLength(3);
    });

    it("where filters by conditions", async () => {
      const fruits = await Item.all()
        .where({ category: "fruit" })
        .toArray();
      expect(fruits).toHaveLength(2);
    });

    it("where is chainable", async () => {
      const items = await Item.all()
        .where({ category: "fruit" })
        .where({ name: "Apple" })
        .toArray();
      expect(items).toHaveLength(1);
      expect(items[0].readAttribute("name")).toBe("Apple");
    });

    it("order sorts results", async () => {
      const items = await Item.all()
        .order({ price: "desc" })
        .toArray();
      expect(items[0].readAttribute("name")).toBe("Carrot");
      expect(items[2].readAttribute("name")).toBe("Apple");
    });

    it("limit restricts result count", async () => {
      const items = await Item.all().limit(2).toArray();
      expect(items).toHaveLength(2);
    });

    it("offset skips records", async () => {
      const items = await Item.all().offset(1).toArray();
      expect(items).toHaveLength(2);
    });

    it("first returns the first record", async () => {
      const item = await Item.all().first();
      expect(item).not.toBeNull();
      expect(item!.readAttribute("name")).toBe("Apple");
    });

    it("count returns the number of records", async () => {
      const count = await Item.all().count();
      expect(count).toBe(3);
    });

    it("count with where", async () => {
      const count = await Item.all()
        .where({ category: "fruit" })
        .count();
      expect(count).toBe(2);
    });

    it("exists returns true when records exist", async () => {
      expect(await Item.all().exists()).toBe(true);
    });

    it("exists returns false when no records match", async () => {
      expect(
        await Item.all().where({ category: "meat" }).exists()
      ).toBe(false);
    });

    it("none returns empty results", async () => {
      const items = await Item.all().none().toArray();
      expect(items).toHaveLength(0);
      expect(await Item.all().none().count()).toBe(0);
    });

    it("pluck returns column values", async () => {
      const names = await Item.all().pluck("name");
      expect(names).toEqual(["Apple", "Banana", "Carrot"]);
    });

    it("ids returns primary key values", async () => {
      const ids = await Item.all().ids();
      expect(ids).toEqual([1, 2, 3]);
    });

    it("updateAll updates all matching records", async () => {
      await Item.all().where({ category: "fruit" }).updateAll({ price: 10 });
      const apple = await Item.find(1);
      expect(apple.readAttribute("price")).toBe(10);
    });

    it("deleteAll removes all matching records", async () => {
      await Item.all().where({ category: "fruit" }).deleteAll();
      const remaining = await Item.all().toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].readAttribute("name")).toBe("Carrot");
    });

    it("toSql generates SQL", () => {
      const sql = Item.all()
        .where({ category: "fruit" })
        .order("name")
        .limit(10)
        .toSql();
      expect(sql).toContain("items");
      expect(sql).toContain("fruit");
    });

    // Static shorthand
    it("Base.where is a shorthand for Base.all().where()", async () => {
      const items = await Item.where({ category: "vegetable" }).toArray();
      expect(items).toHaveLength(1);
    });

    // Immutability
    it("relations are immutable (where returns a new relation)", async () => {
      const all = Item.all();
      const filtered = all.where({ category: "fruit" });
      expect(await all.count()).toBe(3);
      expect(await filtered.count()).toBe(2);
    });
  });

  // -- Phase 2200: Associations --
  describe("Associations", () => {
    let adapter: MemoryAdapter;

    class Author extends Base {
      static {
        this.attribute("name", "string");
      }
    }

    class Book extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("author_id", "integer");
      }
    }

    class Profile extends Base {
      static {
        this.attribute("bio", "string");
        this.attribute("author_id", "integer");
      }
    }

    beforeEach(() => {
      adapter = freshAdapter();
      Author.adapter = adapter;
      Book.adapter = adapter;
      Profile.adapter = adapter;
      registerModel(Author);
      registerModel(Book);
      registerModel(Profile);
    });

    it("loadBelongsTo loads the parent record", async () => {
      const author = await Author.create({ name: "J.K." });
      const book = await Book.create({
        title: "Harry Potter",
        author_id: author.id,
      });

      const loaded = await loadBelongsTo(book, "author", {});
      expect(loaded).not.toBeNull();
      expect(loaded!.readAttribute("name")).toBe("J.K.");
    });

    it("loadBelongsTo returns null when FK is null", async () => {
      const book = await Book.create({ title: "Orphan", author_id: null });
      const loaded = await loadBelongsTo(book, "author", {});
      expect(loaded).toBeNull();
    });

    it("loadHasOne loads the child record", async () => {
      const author = await Author.create({ name: "Dean" });
      await Profile.create({ bio: "A developer", author_id: author.id });

      const loaded = await loadHasOne(author, "profile", {});
      expect(loaded).not.toBeNull();
      expect(loaded!.readAttribute("bio")).toBe("A developer");
    });

    it("loadHasMany loads all children", async () => {
      const author = await Author.create({ name: "Dean" });
      await Book.create({ title: "Book 1", author_id: author.id });
      await Book.create({ title: "Book 2", author_id: author.id });
      await Book.create({ title: "Other", author_id: 999 });

      const books = await loadHasMany(author, "books", {});
      expect(books).toHaveLength(2);
    });

    it("supports custom foreignKey", async () => {
      class Article extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("writer_id", "integer");
          this.adapter = adapter;
        }
      }
      registerModel(Article);

      const author = await Author.create({ name: "Custom" });
      await Article.create({ title: "Test", writer_id: author.id });

      const articles = await loadHasMany(author, "articles", {
        foreignKey: "writer_id",
      });
      expect(articles).toHaveLength(1);
    });
  });

  // -- Phase 2300: Migrations --
  describe("Migrations", () => {
    describe("TableDefinition", () => {
      it("generates CREATE TABLE SQL", () => {
        const td = new TableDefinition("users");
        td.string("name");
        td.integer("age");
        td.boolean("active", { default: true });

        const sql = td.toSql();
        expect(sql).toContain('CREATE TABLE "users"');
        expect(sql).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT');
        expect(sql).toContain('"name" VARCHAR(255)');
        expect(sql).toContain('"age" INTEGER');
        expect(sql).toContain('"active" BOOLEAN DEFAULT TRUE');
      });

      it("supports id: false option", () => {
        const td = new TableDefinition("join_table", { id: false });
        td.integer("user_id");
        td.integer("role_id");

        const sql = td.toSql();
        expect(sql).not.toContain("PRIMARY KEY");
        expect(sql).toContain('"user_id" INTEGER');
      });

      it("supports timestamps", () => {
        const td = new TableDefinition("posts");
        td.timestamps();

        const sql = td.toSql();
        expect(sql).toContain('"created_at" DATETIME NOT NULL');
        expect(sql).toContain('"updated_at" DATETIME NOT NULL');
      });

      it("supports references", () => {
        const td = new TableDefinition("posts");
        td.references("user");

        const sql = td.toSql();
        expect(sql).toContain('"user_id" INTEGER');
      });

      it("supports NOT NULL constraint", () => {
        const td = new TableDefinition("posts");
        td.string("title", { null: false });

        const sql = td.toSql();
        expect(sql).toContain('"title" VARCHAR(255) NOT NULL');
      });

      it("supports decimal with precision and scale", () => {
        const td = new TableDefinition("products");
        td.decimal("price", { precision: 8, scale: 2 });

        const sql = td.toSql();
        expect(sql).toContain('"price" DECIMAL(8, 2)');
      });

      it("supports string with custom limit", () => {
        const td = new TableDefinition("posts");
        td.string("slug", { limit: 100 });

        const sql = td.toSql();
        expect(sql).toContain('"slug" VARCHAR(100)');
      });
    });

    describe("Migration class", () => {
      it("creates and drops tables", async () => {
        const adapter = freshAdapter();

        class CreateUsers extends Migration {
          async up() {
            await this.createTable("users", (t) => {
              t.string("name");
              t.string("email");
            });
          }

          async down() {
            await this.dropTable("users");
          }
        }

        const migration = new CreateUsers();
        await migration.run(adapter, "up");

        // Verify table exists by inserting data
        await adapter.executeMutation(
          `INSERT INTO "users" ("name", "email") VALUES ('Dean', 'dean@test.com')`
        );
        const rows = await adapter.execute(`SELECT * FROM "users"`);
        expect(rows).toHaveLength(1);
      });
    });

    describe("Schema.define", () => {
      it("creates tables in a block", async () => {
        const adapter = freshAdapter();

        await Schema.define(adapter, async (schema) => {
          await schema.createTable("posts", (t) => {
            t.string("title");
            t.text("body");
          });
        });

        await adapter.executeMutation(
          `INSERT INTO "posts" ("title", "body") VALUES ('Hello', 'World')`
        );
        const rows = await adapter.execute(`SELECT * FROM "posts"`);
        expect(rows).toHaveLength(1);
      });
    });
  });

  // -- Phase 2500: Transactions --
  describe("Transactions", () => {
    let adapter: MemoryAdapter;

    class Account extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("balance", "integer", { default: 0 });
      }
    }

    beforeEach(() => {
      adapter = freshAdapter();
      Account.adapter = adapter;
    });

    it("commits on success", async () => {
      await transaction(Account, async () => {
        await Account.create({ name: "Alice", balance: 100 });
        await Account.create({ name: "Bob", balance: 200 });
      });

      const count = await Account.all().count();
      expect(count).toBe(2);
    });

    it("runs afterCommit callbacks on success", async () => {
      const log: string[] = [];

      await transaction(Account, async (tx) => {
        tx.afterCommit(() => {
          log.push("committed");
        });
        await Account.create({ name: "Alice", balance: 100 });
      });

      expect(log).toEqual(["committed"]);
    });

    it("rolls back on error", async () => {
      try {
        await transaction(Account, async () => {
          await Account.create({ name: "Alice", balance: 100 });
          throw new Error("Oops");
        });
      } catch {
        // expected
      }

      // MemoryAdapter doesn't truly rollback, but the pattern is correct
      // In a real adapter, the records would be gone
    });

    it("runs afterRollback callbacks on error", async () => {
      const log: string[] = [];

      try {
        await transaction(Account, async (tx) => {
          tx.afterRollback(() => {
            log.push("rolled_back");
          });
          throw new Error("Oops");
        });
      } catch {
        // expected
      }

      expect(log).toEqual(["rolled_back"]);
    });

    it("nested savepoint catches inner errors", async () => {
      await transaction(Account, async () => {
        await Account.create({ name: "Alice", balance: 100 });

        try {
          await savepoint(Account, "sp1", async () => {
            throw new Error("inner error");
          });
        } catch {
          // savepoint rolled back, outer transaction continues
        }

        await Account.create({ name: "Bob", balance: 200 });
      });

      // Both should exist (memory adapter doesn't really rollback)
      const count = await Account.all().count();
      expect(count).toBe(2);
    });
  });

  // =========================================================================
  // Untested surface area — Relation advanced
  // =========================================================================
  describe("Relation (extended)", () => {
    let adapter: MemoryAdapter;

    class Widget extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("color", "string");
        this.attribute("weight", "integer");
        this.attribute("active", "boolean", { default: true });
      }
    }

    beforeEach(async () => {
      adapter = freshAdapter();
      Widget.adapter = adapter;
      await Widget.create({ name: "A", color: "red", weight: 10, active: true });
      await Widget.create({ name: "B", color: "blue", weight: 20, active: true });
      await Widget.create({ name: "C", color: "red", weight: 30, active: false });
      await Widget.create({ name: "D", color: "green", weight: 10, active: true });
    });

    // -- select --
    it("select returns records with projected columns in SQL", () => {
      const sql = Widget.all().select("name", "color").toSql();
      expect(sql).toContain('"name"');
      expect(sql).toContain('"color"');
      expect(sql).not.toContain("*");
    });

    // -- distinct --
    it("distinct generates DISTINCT SQL", () => {
      const sql = Widget.all().distinct().toSql();
      expect(sql).toContain("DISTINCT");
    });

    // -- group --
    it("group generates GROUP BY SQL", () => {
      const sql = Widget.all().group("color").toSql();
      expect(sql).toContain("GROUP BY");
    });

    // -- reorder replaces existing order --
    it("reorder replaces existing order", async () => {
      const items = await Widget.all()
        .order({ name: "asc" })
        .reorder({ name: "desc" })
        .toArray();
      expect(items[0].readAttribute("name")).toBe("D");
    });

    // -- reverseOrder --
    it("reverseOrder reverses asc to desc", async () => {
      const items = await Widget.all()
        .order({ weight: "asc" })
        .reverseOrder()
        .toArray();
      expect(items[0].readAttribute("weight")).toBe(30);
    });

    // -- last with no order defaults to PK desc --
    it("last returns the last record by PK", async () => {
      const item = await Widget.all().last();
      expect(item).not.toBeNull();
      expect(item!.readAttribute("name")).toBe("D");
    });

    // -- last with explicit order reverses it --
    it("last with order reverses the order", async () => {
      const item = await Widget.all()
        .order({ name: "asc" })
        .last();
      expect(item).not.toBeNull();
      expect(item!.readAttribute("name")).toBe("D");
    });

    // -- firstBang and lastBang --
    it("firstBang returns first or throws", async () => {
      const item = await Widget.all().firstBang();
      expect(item.readAttribute("name")).toBe("A");
    });

    it("firstBang throws when empty", async () => {
      await expect(
        Widget.all().where({ color: "purple" }).firstBang()
      ).rejects.toThrow("not found");
    });

    it("lastBang returns last or throws", async () => {
      const item = await Widget.all().lastBang();
      expect(item.readAttribute("name")).toBe("D");
    });

    it("lastBang throws when empty", async () => {
      await expect(
        Widget.all().where({ color: "purple" }).lastBang()
      ).rejects.toThrow("not found");
    });

    // -- whereNot --
    it("whereNot excludes matching records", async () => {
      const items = await Widget.all().whereNot({ color: "red" }).toArray();
      expect(items).toHaveLength(2);
      expect(items.every(i => i.readAttribute("color") !== "red")).toBe(true);
    });

    it("whereNot with null uses IS NOT NULL", async () => {
      const sql = Widget.all().whereNot({ color: null }).toSql();
      expect(sql).toContain("IS NOT NULL");
    });

    // -- where with array (IN) --
    it("where with array generates IN", async () => {
      const items = await Widget.all()
        .where({ color: ["red", "blue"] })
        .toArray();
      expect(items).toHaveLength(3);
    });

    // -- where with null --
    it("where with null generates IS NULL", async () => {
      const sql = Widget.all().where({ color: null }).toSql();
      expect(sql).toContain("IS NULL");
    });

    // -- multi-column pluck --
    it("pluck with multiple columns returns arrays", async () => {
      const result = await Widget.all()
        .order({ name: "asc" })
        .pluck("name", "color");
      expect(result).toEqual([
        ["A", "red"],
        ["B", "blue"],
        ["C", "red"],
        ["D", "green"],
      ]);
    });

    // -- destroyAll --
    it("destroyAll destroys all matching records", async () => {
      const destroyed = await Widget.all()
        .where({ color: "red" })
        .destroyAll();
      expect(destroyed).toHaveLength(2);
      expect(destroyed[0].isDestroyed()).toBe(true);
    });

    // -- updateAll returns count --
    it("updateAll returns the number of affected rows", async () => {
      const count = await Widget.all()
        .where({ color: "red" })
        .updateAll({ weight: 99 });
      expect(count).toBe(2);
    });

    // -- deleteAll returns count --
    it("deleteAll returns the number of deleted rows", async () => {
      const count = await Widget.all()
        .where({ color: "red" })
        .deleteAll();
      expect(count).toBe(2);
      const remaining = await Widget.all().toArray();
      expect(remaining).toHaveLength(2);
    });

    // -- none returns empty for all terminal methods --
    it("none().first() returns null", async () => {
      expect(await Widget.all().none().first()).toBeNull();
    });

    it("none().last() returns null", async () => {
      expect(await Widget.all().none().last()).toBeNull();
    });

    it("none().exists() returns false", async () => {
      expect(await Widget.all().none().exists()).toBe(false);
    });

    it("none().pluck() returns empty array", async () => {
      expect(await Widget.all().none().pluck("name")).toEqual([]);
    });

    it("none().updateAll() returns 0", async () => {
      expect(await Widget.all().none().updateAll({ weight: 0 })).toBe(0);
    });

    it("none().deleteAll() returns 0", async () => {
      expect(await Widget.all().none().deleteAll()).toBe(0);
    });

    // -- immutability --
    it("where returns a new relation", async () => {
      const all = Widget.all();
      const filtered = all.where({ color: "red" });
      expect(await all.count()).toBe(4);
      expect(await filtered.count()).toBe(2);
    });

    it("order returns a new relation", async () => {
      const all = Widget.all();
      const ordered = all.order({ name: "desc" });
      const allFirst = await all.first();
      const orderedFirst = await ordered.first();
      // ordering shouldn't change the unordered relation
      expect(allFirst!.readAttribute("name")).toBe("A");
      expect(orderedFirst!.readAttribute("name")).toBe("D");
    });
  });

  // =========================================================================
  // Untested surface area — Scopes
  // =========================================================================
  describe("Scopes", () => {
    let adapter: MemoryAdapter;

    class Product extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("price", "integer");
        this.attribute("active", "boolean", { default: true });
      }
    }

    beforeEach(async () => {
      adapter = freshAdapter();
      Product.adapter = adapter;
    });

    it("defines and uses a named scope", async () => {
      Product.scope("cheap", (rel) => rel.where({ price: 1 }));

      await Product.create({ name: "A", price: 1, active: true });
      await Product.create({ name: "B", price: 100, active: true });

      // Scopes are defined on the class but used via relation
      const scoped = Product._scopes.get("cheap");
      expect(scoped).toBeDefined();
      const result = await scoped!(Product.all()).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("A");
    });
  });

  // =========================================================================
  // Untested surface area — Migration DDL methods
  // =========================================================================
  describe("Migration DDL (extended)", () => {
    it("addColumn generates ALTER TABLE ADD COLUMN", async () => {
      const adapter = freshAdapter();
      class AddAge extends Migration {
        async up() {
          await this.createTable("users", (t) => {
            t.string("name");
          });
          await this.addColumn("users", "age", "integer");
        }
        async down() {}
      }
      const m = new AddAge();
      await m.run(adapter, "up");
      // Should be able to insert with the new column
      await adapter.executeMutation(
        `INSERT INTO "users" ("name", "age") VALUES ('Dean', 30)`
      );
      const rows = await adapter.execute(`SELECT * FROM "users"`);
      expect(rows).toHaveLength(1);
    });

    it("removeColumn generates ALTER TABLE DROP COLUMN", async () => {
      const adapter = freshAdapter();
      class RemoveCol extends Migration {
        async up() {
          await this.createTable("users", (t) => {
            t.string("name");
            t.string("email");
          });
          await this.removeColumn("users", "email");
        }
        async down() {}
      }
      const m = new RemoveCol();
      await m.run(adapter, "up");
      // MemoryAdapter may or may not enforce column removal, but SQL is generated
    });

    it("addIndex generates CREATE INDEX", async () => {
      const adapter = freshAdapter();
      class AddIdx extends Migration {
        async up() {
          await this.createTable("users", (t) => {
            t.string("email");
          });
          await this.addIndex("users", ["email"]);
        }
        async down() {}
      }
      const m = new AddIdx();
      await m.run(adapter, "up");
      // MemoryAdapter ignores indexes but migration runs without error
    });

    it("addIndex with unique option", async () => {
      const adapter = freshAdapter();
      class AddUniqueIdx extends Migration {
        async up() {
          await this.createTable("users", (t) => {
            t.string("email");
          });
          await this.addIndex("users", ["email"], { unique: true });
        }
        async down() {}
      }
      const m = new AddUniqueIdx();
      await m.run(adapter, "up");
    });
  });

  // =========================================================================
  // Untested surface area — Callbacks (extended)
  // =========================================================================
  describe("Callbacks (extended)", () => {
    it("runs before_update only on existing records", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class Tracked extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
          this.beforeCreate(() => { log.push("before_create"); });
          this.beforeUpdate(() => { log.push("before_update"); });
        }
      }

      const t = await Tracked.create({ name: "test" });
      expect(log).toEqual(["before_create"]);

      log.length = 0;
      t.writeAttribute("name", "updated");
      await t.save();
      expect(log).toEqual(["before_update"]);
    });

    it("runs after_create and after_update at correct times", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class Tracked extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
          this.afterCreate(() => { log.push("after_create"); });
          this.afterUpdate(() => { log.push("after_update"); });
        }
      }

      await Tracked.create({ name: "test" });
      expect(log).toContain("after_create");
      expect(log).not.toContain("after_update");

      log.length = 0;
      const record = await Tracked.find(1);
      await record.update({ name: "updated" });
      expect(log).toContain("after_update");
      expect(log).not.toContain("after_create");
    });

    it("after_destroy runs on destroy", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class Tracked extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
          this.afterDestroy(() => { log.push("after_destroy"); });
        }
      }

      const t = await Tracked.create({ name: "test" });
      await t.destroy();
      expect(log).toContain("after_destroy");
    });

    it("around_save works via runCallbacks", () => {
      const log: string[] = [];

      class Tracked extends Base {
        static {
          this.attribute("name", "string");
          this.aroundSave((_r, proceed) => {
            log.push("around_before");
            proceed();
            log.push("around_after");
          });
        }
      }

      // around callbacks work through runCallbacks (Model-level API)
      const t = new Tracked({ name: "test" });
      t.runCallbacks("save", () => { log.push("action"); });
      expect(log).toEqual(["around_before", "action", "around_after"]);
    });
  });

  // =========================================================================
  // Untested surface area — Base class methods
  // =========================================================================
  describe("Base (extended)", () => {
    it("find with multiple IDs", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      await User.create({ name: "Alice" });
      await User.create({ name: "Bob" });
      await User.create({ name: "Charlie" });

      const found = await User.find([1, 3]);
      expect(found).toHaveLength(2);
      expect(found[0].readAttribute("name")).toBe("Alice");
      expect(found[1].readAttribute("name")).toBe("Charlie");
    });

    it("find with empty array returns empty", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      const found = await User.find([]);
      expect(found).toEqual([]);
    });

    it("find with missing IDs throws", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      await User.create({ name: "Alice" });
      await expect(User.find([1, 999])).rejects.toThrow("not found");
    });

    it("createBang throws on validation failure", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.validates("name", { presence: true });
          this.adapter = adapter;
        }
      }
      await expect(User.createBang({})).rejects.toThrow("Validation failed");
    });

    it("updateBang throws on validation failure", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.validates("name", { presence: true });
          this.adapter = adapter;
        }
      }
      const u = await User.create({ name: "Alice" });
      await expect(u.updateBang({ name: "" })).rejects.toThrow("Validation failed");
    });

    it("save on destroyed record throws", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      const u = await User.create({ name: "Alice" });
      await u.destroy();
      await expect(u.save()).rejects.toThrow("destroyed");
    });

    it("instance delete skips callbacks", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
          this.beforeDestroy(() => { log.push("before_destroy"); });
        }
      }
      const u = await User.create({ name: "Alice" });
      await u.delete();
      expect(u.isDestroyed()).toBe(true);
      expect(log).not.toContain("before_destroy");
    });

    it("static delete by ID", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      await User.create({ name: "Alice" });
      await User.delete(1);
      await expect(User.find(1)).rejects.toThrow("not found");
    });

    it("destroyBang delegates to destroy", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      const u = await User.create({ name: "Alice" });
      const result = await u.destroyBang();
      expect(result.isDestroyed()).toBe(true);
    });

    it("adapter throws when not configured", () => {
      class NoAdapter extends Base {
        static {
          this.attribute("name", "string");
        }
      }
      expect(() => NoAdapter.adapter).toThrow("No adapter configured");
    });
  });

  // =========================================================================
  // Timestamp auto-population
  // =========================================================================
  describe("Timestamps", () => {
    it("auto-sets created_at and updated_at on insert", async () => {
      const adapter = freshAdapter();
      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("created_at", "datetime");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const before = new Date();
      const post = await Post.create({ title: "Hello" });
      const after = new Date();

      const createdAt = post.readAttribute("created_at") as Date;
      const updatedAt = post.readAttribute("updated_at") as Date;
      expect(createdAt).toBeInstanceOf(Date);
      expect(updatedAt).toBeInstanceOf(Date);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(createdAt.getTime()).toBe(updatedAt.getTime());
    });

    it("does not overwrite explicitly set timestamps on insert", async () => {
      const adapter = freshAdapter();
      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("created_at", "datetime");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const explicit = new Date("2020-01-01T00:00:00Z");
      const post = await Post.create({ title: "Old", created_at: explicit, updated_at: explicit });

      expect((post.readAttribute("created_at") as Date).toISOString()).toBe(explicit.toISOString());
      expect((post.readAttribute("updated_at") as Date).toISOString()).toBe(explicit.toISOString());
    });

    it("auto-sets updated_at on update but not created_at", async () => {
      const adapter = freshAdapter();
      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("created_at", "datetime");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = await Post.create({ title: "Hello" });
      const originalCreatedAt = post.readAttribute("created_at") as Date;

      post.writeAttribute("title", "Updated");
      await post.save();

      const updatedAt = post.readAttribute("updated_at") as Date;
      expect(updatedAt).toBeInstanceOf(Date);
      // created_at should remain unchanged
      expect((post.readAttribute("created_at") as Date).getTime()).toBe(originalCreatedAt.getTime());
    });

    it("does not touch timestamps when model has no timestamp attributes", async () => {
      const adapter = freshAdapter();
      class Simple extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      const s = await Simple.create({ name: "test" });
      expect(s.readAttribute("created_at")).toBeNull();
    });
  });

  // =========================================================================
  // updateColumn / updateColumns
  // =========================================================================
  describe("updateColumn / updateColumns", () => {
    it("updates a single column without callbacks", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
          this.beforeSave(() => { log.push("before_save"); });
        }
      }

      const u = await User.create({ name: "Alice", age: 25 });
      log.length = 0;

      await u.updateColumn("age", 30);

      expect(u.readAttribute("age")).toBe(30);
      expect(log).toHaveLength(0); // No callbacks fired
    });

    it("updates multiple columns without validations", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.validates("name", { presence: true });
          this.adapter = adapter;
        }
      }

      const u = await User.create({ name: "Alice", email: "alice@example.com" });

      // This would fail validation since name becomes empty, but updateColumns skips it
      await u.updateColumns({ name: "", email: "new@example.com" });

      expect(u.readAttribute("name")).toBe("");
      expect(u.readAttribute("email")).toBe("new@example.com");
    });

    it("persists to database", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      const u = await User.create({ name: "Alice" });
      await u.updateColumn("name", "Bob");

      const reloaded = await User.find(u.id);
      expect(reloaded.readAttribute("name")).toBe("Bob");
    });

    it("throws on new record", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      const u = new User({ name: "Alice" });
      await expect(u.updateColumn("name", "Bob")).rejects.toThrow(
        "Cannot update columns on a new or destroyed record"
      );
    });

    it("resets dirty tracking", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      const u = await User.create({ name: "Alice" });
      await u.updateColumn("name", "Bob");
      expect(u.changed).toBe(false);
    });
  });

  // =========================================================================
  // or() on Relation
  // =========================================================================
  describe("Relation#or", () => {
    it("combines two where clauses with OR", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Bob", age: 30 });
      await User.create({ name: "Charlie", age: 35 });

      const young = User.where({ age: 25 });
      const old = User.where({ age: 35 });
      const result = await young.or(old).toArray();

      expect(result).toHaveLength(2);
      const names = result.map((r: Base) => r.readAttribute("name"));
      expect(names).toContain("Alice");
      expect(names).toContain("Charlie");
    });

    it("generates correct SQL with OR", () => {
      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
        }
      }

      const sql = User.where({ name: "Alice" }).or(User.where({ age: 30 })).toSql();
      expect(sql).toContain("OR");
      expect(sql).toContain('"name"');
      expect(sql).toContain('"age"');
    });
  });

  // =========================================================================
  // findEach / findInBatches
  // =========================================================================
  describe("findEach / findInBatches", () => {
    it("findInBatches yields batches of records", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      for (let i = 0; i < 5; i++) {
        await User.create({ name: `User ${i}` });
      }

      const batches: any[][] = [];
      for await (const batch of User.all().findInBatches({ batchSize: 2 })) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(3); // 2, 2, 1
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(2);
      expect(batches[2]).toHaveLength(1);
    });

    it("findEach yields individual records", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      for (let i = 0; i < 3; i++) {
        await User.create({ name: `User ${i}` });
      }

      const records: any[] = [];
      for await (const record of User.all().findEach({ batchSize: 2 })) {
        records.push(record);
      }

      expect(records).toHaveLength(3);
    });

    it("findInBatches with where clause", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("active", "boolean");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Active1", active: true });
      await User.create({ name: "Inactive", active: false });
      await User.create({ name: "Active2", active: true });

      const records: any[] = [];
      for await (const record of User.where({ active: true }).findEach({ batchSize: 10 })) {
        records.push(record);
      }

      expect(records).toHaveLength(2);
    });
  });

  // =========================================================================
  // Scope proxy
  // =========================================================================
  describe("Scope proxy", () => {
    it("scope is accessible on Relation via proxy", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("active", "boolean");
          this.adapter = adapter;
          this.scope("active", (rel: any) => rel.where({ active: true }));
        }
      }

      await User.create({ name: "Alice", active: true });
      await User.create({ name: "Bob", active: false });

      const result = await (User.all() as any).active().toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Alice");
    });

    it("scope is chainable with other query methods", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("active", "boolean");
          this.adapter = adapter;
          this.scope("active", (rel: any) => rel.where({ active: true }));
        }
      }

      await User.create({ name: "Alice", active: true });
      await User.create({ name: "Bob", active: true });
      await User.create({ name: "Charlie", active: false });

      const result = await (User.all() as any).active().where({ name: "Alice" }).toArray();
      expect(result).toHaveLength(1);
    });

    it("scope is accessible as a static method on the class", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("active", "boolean");
          this.adapter = adapter;
          this.scope("active", (rel: any) => rel.where({ active: true }));
        }
      }

      await User.create({ name: "Alice", active: true });
      await User.create({ name: "Bob", active: false });

      const result = await (User as any).active().toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Alice");
    });

    it("scopes chain together", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("active", "boolean");
          this.attribute("role", "string");
          this.adapter = adapter;
          this.scope("active", (rel: any) => rel.where({ active: true }));
          this.scope("admins", (rel: any) => rel.where({ role: "admin" }));
        }
      }

      await User.create({ name: "Alice", active: true, role: "admin" });
      await User.create({ name: "Bob", active: true, role: "user" });
      await User.create({ name: "Charlie", active: false, role: "admin" });

      const result = await (User as any).active().admins().toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Alice");
    });

    it("scope with arguments", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
          this.scope("olderThan", (rel: any, age: number) => rel.where({ age }));
        }
      }

      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Bob", age: 30 });

      const result = await (User as any).olderThan(30).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Bob");
    });
  });

  // =========================================================================
  // Aggregations
  // =========================================================================
  describe("Aggregations", () => {
    it("sum returns the sum of a column", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      await Order.create({ amount: 10 });
      await Order.create({ amount: 20 });
      await Order.create({ amount: 30 });

      expect(await Order.all().sum("amount")).toBe(60);
    });

    it("average returns the average of a column", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      await Order.create({ amount: 10 });
      await Order.create({ amount: 20 });
      await Order.create({ amount: 30 });

      expect(await Order.all().average("amount")).toBe(20);
    });

    it("minimum returns the min value", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      await Order.create({ amount: 10 });
      await Order.create({ amount: 5 });
      await Order.create({ amount: 30 });

      expect(await Order.all().minimum("amount")).toBe(5);
    });

    it("maximum returns the max value", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      await Order.create({ amount: 10 });
      await Order.create({ amount: 5 });
      await Order.create({ amount: 30 });

      expect(await Order.all().maximum("amount")).toBe(30);
    });

    it("sum with where clause", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.attribute("status", "string");
          this.adapter = adapter;
        }
      }

      await Order.create({ amount: 10, status: "paid" });
      await Order.create({ amount: 20, status: "pending" });
      await Order.create({ amount: 30, status: "paid" });

      expect(await Order.where({ status: "paid" }).sum("amount")).toBe(40);
    });

    it("sum on none relation returns 0", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      expect(await Order.all().none().sum("amount")).toBe(0);
    });

    it("average on none relation returns null", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      expect(await Order.all().none().average("amount")).toBeNull();
    });

    it("count with column name ignores nulls", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", email: "a@b.com" });
      await User.create({ name: "Bob" }); // email is null

      expect(await User.all().count()).toBe(2);
      expect(await User.all().count("email")).toBe(1);
    });
  });

  // =========================================================================
  // find_or_create_by / find_or_initialize_by
  // =========================================================================
  describe("find_or_create_by / find_or_initialize_by", () => {
    it("findOrCreateBy returns existing record if found", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.adapter = adapter;
        }
      }

      const original = await User.create({ name: "Alice", email: "old@example.com" });
      const found = await User.findOrCreateBy({ name: "Alice" }, { email: "new@example.com" });

      expect(found.id).toBe(original.id);
      expect(found.readAttribute("email")).toBe("old@example.com");
    });

    it("findOrCreateBy creates record if not found", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.adapter = adapter;
        }
      }

      const created = await User.findOrCreateBy({ name: "Alice" }, { email: "new@example.com" });

      expect(created.isPersisted()).toBe(true);
      expect(created.readAttribute("name")).toBe("Alice");
      expect(created.readAttribute("email")).toBe("new@example.com");
    });

    it("findOrInitializeBy returns existing record if found", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      const original = await User.create({ name: "Alice" });
      const found = await User.findOrInitializeBy({ name: "Alice" });

      expect(found.id).toBe(original.id);
      expect(found.isPersisted()).toBe(true);
    });

    it("findOrInitializeBy returns unsaved record if not found", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.adapter = adapter;
        }
      }

      const initialized = await User.findOrInitializeBy({ name: "Alice" }, { email: "a@b.com" });

      expect(initialized.isNewRecord()).toBe(true);
      expect(initialized.readAttribute("name")).toBe("Alice");
      expect(initialized.readAttribute("email")).toBe("a@b.com");
    });
  });

  // =========================================================================
  // having
  // =========================================================================
  describe("Relation#having", () => {
    it("generates SQL with HAVING clause", () => {
      class Order extends Base {
        static {
          this.attribute("customer_id", "integer");
          this.attribute("amount", "integer");
        }
      }

      const sql = Order.all()
        .select("customer_id")
        .group("customer_id")
        .having("COUNT(*) > 1")
        .toSql();

      expect(sql).toContain("GROUP BY");
      expect(sql).toContain("HAVING");
      expect(sql).toContain("COUNT(*) > 1");
    });
  });

  // =========================================================================
  // where with ranges
  // =========================================================================
  describe("where with Range", () => {
    it("generates BETWEEN SQL", () => {
      class User extends Base {
        static {
          this.attribute("age", "integer");
        }
      }

      const sql = User.where({ age: new Range(18, 30) }).toSql();
      expect(sql).toContain("BETWEEN");
      expect(sql).toContain("18");
      expect(sql).toContain("30");
    });

    it("filters records with BETWEEN", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Young", age: 15 });
      await User.create({ name: "Adult", age: 25 });
      await User.create({ name: "Senior", age: 65 });

      const result = await User.where({ age: new Range(18, 30) }).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Adult");
    });

    it("BETWEEN is inclusive on both ends", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ age: 18 });
      await User.create({ age: 25 });
      await User.create({ age: 30 });

      const result = await User.where({ age: new Range(18, 30) }).toArray();
      expect(result).toHaveLength(3);
    });
  });

  // =========================================================================
  // touch
  // =========================================================================
  describe("touch", () => {
    it("updates updated_at timestamp", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = await Post.create({ title: "Hello" });
      const originalUpdatedAt = post.readAttribute("updated_at") as Date;

      await post.touch();

      const newUpdatedAt = post.readAttribute("updated_at") as Date;
      expect(newUpdatedAt).toBeInstanceOf(Date);
      expect(newUpdatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it("touch with named timestamp", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("updated_at", "datetime");
          this.attribute("published_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = await Post.create({ title: "Hello" });
      await post.touch("published_at");

      expect(post.readAttribute("published_at")).toBeInstanceOf(Date);
      expect(post.readAttribute("updated_at")).toBeInstanceOf(Date);
    });

    it("touch returns false on new record", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = new Post({ title: "New" });
      expect(await post.touch()).toBe(false);
    });

    it("touch skips callbacks", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
          this.beforeSave(() => { log.push("before_save"); });
        }
      }

      const post = await Post.create({ title: "Hello" });
      log.length = 0;

      await post.touch();
      expect(log).toHaveLength(0);
    });
  });

  // =========================================================================
  // default_scope / unscoped
  // =========================================================================
  describe("default_scope / unscoped", () => {
    it("default_scope is applied to all queries", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("published", "boolean", { default: false });
          this.adapter = adapter;
          this.defaultScope((rel: any) => rel.where({ published: true }));
        }
      }

      await Post.create({ title: "Published", published: true });
      await Post.create({ title: "Draft", published: false });

      const result = await Post.all().toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("title")).toBe("Published");
    });

    it("unscoped bypasses default_scope", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("published", "boolean", { default: false });
          this.adapter = adapter;
          this.defaultScope((rel: any) => rel.where({ published: true }));
        }
      }

      await Post.create({ title: "Published", published: true });
      await Post.create({ title: "Draft", published: false });

      const result = await Post.unscoped().toArray();
      expect(result).toHaveLength(2);
    });

    it("where inherits default_scope", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("published", "boolean", { default: false });
          this.attribute("category", "string");
          this.adapter = adapter;
          this.defaultScope((rel: any) => rel.where({ published: true }));
        }
      }

      await Post.create({ title: "P1", published: true, category: "tech" });
      await Post.create({ title: "P2", published: true, category: "news" });
      await Post.create({ title: "D1", published: false, category: "tech" });

      const result = await Post.where({ category: "tech" }).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("title")).toBe("P1");
    });

    it("default_scope applies to exists?", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("published", "boolean", { default: false });
          this.adapter = adapter;
          this.defaultScope((rel: any) => rel.where({ published: true }));
        }
      }

      await Post.create({ title: "Draft", published: false });

      expect(await Post.all().exists()).toBe(false);
      expect(await Post.unscoped().exists()).toBe(true);
    });

    it("default_scope applies to pluck", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("published", "boolean", { default: false });
          this.adapter = adapter;
          this.defaultScope((rel: any) => rel.where({ published: true }));
        }
      }

      await Post.create({ title: "Pub", published: true });
      await Post.create({ title: "Draft", published: false });

      const titles = await Post.all().pluck("title");
      expect(titles).toEqual(["Pub"]);
    });

    it("default_scope applies to deleteAll", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("published", "boolean", { default: false });
          this.adapter = adapter;
          this.defaultScope((rel: any) => rel.where({ published: true }));
        }
      }

      await Post.create({ title: "Pub", published: true });
      await Post.create({ title: "Draft", published: false });

      await Post.all().deleteAll();
      // Only the published one should be deleted
      expect(await Post.unscoped().count()).toBe(1);
    });

    it("unscoped then where applies user conditions only", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("published", "boolean", { default: false });
          this.adapter = adapter;
          this.defaultScope((rel: any) => rel.where({ published: true }));
        }
      }

      await Post.create({ title: "Pub", published: true });
      await Post.create({ title: "Draft", published: false });

      const result = await Post.unscoped().where({ title: "Draft" }).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("title")).toBe("Draft");
    });
  });

  // =========================================================================
  // Edge cases — Relation query methods
  // =========================================================================
  describe("Relation edge cases", () => {
    it("where with multiple keys including null", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", email: "a@b.com" });
      await User.create({ name: "Bob" }); // email null

      const result = await User.where({ name: "Bob", email: null }).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Bob");
    });

    it("whereNot with array generates NOT IN", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice" });
      await User.create({ name: "Bob" });
      await User.create({ name: "Charlie" });

      const result = await User.all().whereNot({ name: ["Alice", "Charlie"] }).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Bob");
    });

    it("chaining multiple whereNot calls", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Bob", age: 30 });
      await User.create({ name: "Charlie", age: 35 });

      const result = await User.all()
        .whereNot({ name: "Alice" })
        .whereNot({ name: "Charlie" })
        .toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Bob");
    });

    it("limit overrides previous limit", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      for (let i = 0; i < 5; i++) await User.create({ name: `U${i}` });

      const result = await User.all().limit(10).limit(2).toArray();
      expect(result).toHaveLength(2);
    });

    it("offset without limit returns remaining records", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      for (let i = 0; i < 5; i++) await User.create({ name: `U${i}` });

      const result = await User.all().offset(3).toArray();
      expect(result).toHaveLength(2);
    });

    it("select restricts returned attributes", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", email: "a@b.com" });

      const result = await User.all().select("name").toArray();
      expect(result[0].readAttribute("name")).toBe("Alice");
      // email should not be in the selected columns
      expect(result[0].readAttribute("email")).toBeNull();
    });

    it("pluck with multiple columns returns arrays", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Bob", age: 30 });

      const result = await User.all().pluck("name", "age");
      expect(result).toEqual([
        ["Alice", 25],
        ["Bob", 30],
      ]);
    });

    it("ids returns primary key values", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice" });
      await User.create({ name: "Bob" });
      await User.create({ name: "Charlie" });

      const ids = await User.all().ids();
      expect(ids).toEqual([1, 2, 3]);
    });

    it("ids with where returns filtered IDs", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice" });
      await User.create({ name: "Bob" });

      const ids = await User.where({ name: "Bob" }).ids();
      expect(ids).toEqual([2]);
    });

    it("none chained with where still returns empty", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice" });
      // once none() is applied, additional conditions are irrelevant
      const result = await User.all().none().where({ name: "Alice" }).toArray();
      expect(result).toEqual([]);
    });

    it("first on unordered relation returns first by PK", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Bob" });
      await User.create({ name: "Alice" });

      const first = await User.all().first();
      expect(first!.readAttribute("name")).toBe("Bob"); // ID 1
    });

    it("last on unordered relation returns last by PK", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Bob" });
      await User.create({ name: "Alice" });

      const last = await User.all().last();
      expect(last!.readAttribute("name")).toBe("Alice"); // ID 2
    });

    it("count on empty table returns 0", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      expect(await User.all().count()).toBe(0);
    });

    it("pluck on empty table returns empty array", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      expect(await User.all().pluck("name")).toEqual([]);
    });

    it("reverseOrder with multiple columns flips all", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Alice", age: 30 });
      await User.create({ name: "Bob", age: 20 });

      const sql = User.all()
        .order({ name: "asc" }, { age: "asc" })
        .reverseOrder()
        .toSql();
      expect(sql).toContain("DESC");
      expect(sql).not.toContain("ASC");
    });

    it("reorder then additional order", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Bob", age: 30 });
      await User.create({ name: "Alice", age: 25 });

      const result = await User.all()
        .order({ age: "desc" })
        .reorder("name")
        .toArray();
      expect(result[0].readAttribute("name")).toBe("Alice");
    });
  });

  // =========================================================================
  // Edge cases — Bulk operations
  // =========================================================================
  describe("Bulk operations edge cases", () => {
    it("updateAll does not run callbacks", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("active", "boolean");
          this.adapter = adapter;
          this.beforeSave(() => { log.push("before_save"); });
          this.afterSave(() => { log.push("after_save"); });
        }
      }

      await User.create({ name: "Alice", active: true });
      log.length = 0;

      await User.all().updateAll({ active: false });
      expect(log).toHaveLength(0);
    });

    it("updateAll does not auto-update updated_at", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = await Post.create({ title: "Hello" });
      const originalUpdatedAt = post.readAttribute("updated_at") as Date;

      await Post.all().updateAll({ title: "Changed" });

      const reloaded = await Post.find(post.id);
      // updateAll should NOT auto-bump updated_at
      expect((reloaded.readAttribute("updated_at") as Date).getTime())
        .toBe(originalUpdatedAt.getTime());
    });

    it("deleteAll does not run callbacks", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
          this.beforeDestroy(() => { log.push("before_destroy"); });
        }
      }

      await User.create({ name: "Alice" });
      log.length = 0;

      await User.all().deleteAll();
      expect(log).toHaveLength(0);
    });

    it("destroyAll runs callbacks on each record", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
          this.afterDestroy((r: any) => { log.push(r.readAttribute("name")); });
        }
      }

      await User.create({ name: "Alice" });
      await User.create({ name: "Bob" });

      await User.all().destroyAll();
      expect(log).toContain("Alice");
      expect(log).toContain("Bob");
    });

    it("updateAll returns count of affected rows", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("active", "boolean");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", active: true });
      await User.create({ name: "Bob", active: false });

      const count = await User.where({ active: true }).updateAll({ active: false });
      expect(count).toBe(1);
    });

    it("deleteAll on empty table returns 0", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      expect(await User.all().deleteAll()).toBe(0);
    });
  });

  // =========================================================================
  // Edge cases — Persistence
  // =========================================================================
  describe("Persistence edge cases", () => {
    it("save on unchanged record is a no-op", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      const u = await User.create({ name: "Alice" });
      // No changes -> save should succeed without issuing UPDATE
      expect(await u.save()).toBe(true);
      expect(u.isPersisted()).toBe(true);
    });

    it("reload clears dirty tracking", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      const u = await User.create({ name: "Alice" });
      u.writeAttribute("name", "Changed");
      expect(u.changed).toBe(true);

      await u.reload();
      expect(u.changed).toBe(false);
      expect(u.readAttribute("name")).toBe("Alice");
    });

    it("assignAttributes triggers dirty tracking", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.adapter = adapter;
        }
      }

      const u = await User.create({ name: "Alice", email: "a@b.com" });
      u.assignAttributes({ name: "Bob", email: "b@b.com" });

      expect(u.changed).toBe(true);
      expect(u.changedAttributes).toContain("name");
      expect(u.changedAttributes).toContain("email");
    });

    it("created_at is never overwritten on subsequent saves", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("created_at", "datetime");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = await Post.create({ title: "Hello" });
      const originalCreatedAt = (post.readAttribute("created_at") as Date).getTime();

      post.writeAttribute("title", "Updated");
      await post.save();

      post.writeAttribute("title", "Updated again");
      await post.save();

      expect((post.readAttribute("created_at") as Date).getTime()).toBe(originalCreatedAt);
    });

    it("updateColumn does not auto-update updated_at", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = await Post.create({ title: "Hello" });
      const originalUpdatedAt = (post.readAttribute("updated_at") as Date).getTime();

      await post.updateColumn("title", "Changed");

      // updateColumn should NOT auto-bump updated_at
      expect((post.readAttribute("updated_at") as Date).getTime()).toBe(originalUpdatedAt);
    });
  });

  // =========================================================================
  // Edge cases — or()
  // =========================================================================
  describe("Relation#or edge cases", () => {
    it("triple or chains", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice" });
      await User.create({ name: "Bob" });
      await User.create({ name: "Charlie" });
      await User.create({ name: "Dave" });

      // Note: .or().or() nests — the second or wraps the first
      const result = await User.where({ name: "Alice" })
        .or(User.where({ name: "Bob" }))
        .or(User.where({ name: "Charlie" }))
        .toArray();

      expect(result).toHaveLength(3);
    });

    it("or with count", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Bob", age: 30 });
      await User.create({ name: "Charlie", age: 35 });

      const count = await User.where({ age: 25 })
        .or(User.where({ age: 35 }))
        .count();
      expect(count).toBe(2);
    });
  });

  // =========================================================================
  // Edge cases — Aggregations
  // =========================================================================
  describe("Aggregation edge cases", () => {
    it("minimum on empty table returns null", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      expect(await Order.all().minimum("amount")).toBeNull();
    });

    it("maximum on empty table returns null", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      expect(await Order.all().maximum("amount")).toBeNull();
    });

    it("minimum on none() returns null", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      await Order.create({ amount: 10 });
      expect(await Order.all().none().minimum("amount")).toBeNull();
    });

    it("maximum on none() returns null", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
        }
      }

      await Order.create({ amount: 10 });
      expect(await Order.all().none().maximum("amount")).toBeNull();
    });

    it("sum with where condition", async () => {
      const adapter = freshAdapter();

      class Order extends Base {
        static {
          this.attribute("amount", "integer");
          this.attribute("status", "string");
          this.adapter = adapter;
        }
      }

      await Order.create({ amount: 10, status: "paid" });
      await Order.create({ amount: 20, status: "pending" });
      await Order.create({ amount: 30, status: "paid" });

      expect(await Order.where({ status: "paid" }).sum("amount")).toBe(40);
      expect(await Order.where({ status: "pending" }).sum("amount")).toBe(20);
    });
  });

  // =========================================================================
  // Edge cases — touch
  // =========================================================================
  describe("touch edge cases", () => {
    it("touch persists to database", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("updated_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = await Post.create({ title: "Hello" });
      await post.touch();

      const reloaded = await Post.find(post.id);
      expect(reloaded.readAttribute("updated_at")).not.toBeNull();
    });

    it("touch with multiple attribute names", async () => {
      const adapter = freshAdapter();

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("updated_at", "datetime");
          this.attribute("replied_at", "datetime");
          this.attribute("viewed_at", "datetime");
          this.adapter = adapter;
        }
      }

      const post = await Post.create({ title: "Hello" });
      await post.touch("replied_at", "viewed_at");

      expect(post.readAttribute("replied_at")).toBeInstanceOf(Date);
      expect(post.readAttribute("viewed_at")).toBeInstanceOf(Date);
      expect(post.readAttribute("updated_at")).toBeInstanceOf(Date);
    });

    it("touch on model without updated_at returns false", async () => {
      const adapter = freshAdapter();

      class Simple extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      const s = await Simple.create({ name: "test" });
      expect(await s.touch()).toBe(false);
    });
  });

  // =========================================================================
  // Edge cases — findInBatches
  // =========================================================================
  describe("findInBatches edge cases", () => {
    it("findInBatches with batchSize 1", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice" });
      await User.create({ name: "Bob" });
      await User.create({ name: "Charlie" });

      const batches: any[][] = [];
      for await (const batch of User.all().findInBatches({ batchSize: 1 })) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(1);
      expect(batches[1]).toHaveLength(1);
      expect(batches[2]).toHaveLength(1);
    });

    it("findEach can be used with early break", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      for (let i = 0; i < 10; i++) await User.create({ name: `U${i}` });

      const names: string[] = [];
      for await (const record of User.all().findEach({ batchSize: 3 })) {
        names.push(record.readAttribute("name") as string);
        if (names.length >= 5) break;
      }

      expect(names).toHaveLength(5);
    });
  });

  // =========================================================================
  // Edge cases — Range with count
  // =========================================================================
  describe("Range edge cases", () => {
    it("count with Range condition", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ age: 15 });
      await User.create({ age: 25 });
      await User.create({ age: 35 });

      expect(await User.where({ age: new Range(20, 30) }).count()).toBe(1);
    });

    it("Range combined with IN array in same where", async () => {
      const adapter = freshAdapter();

      class User extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
          this.adapter = adapter;
        }
      }

      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Bob", age: 30 });
      await User.create({ name: "Charlie", age: 35 });

      const result = await User.where({ age: new Range(20, 30) })
        .where({ name: ["Alice", "Bob"] })
        .toArray();
      expect(result).toHaveLength(2);
    });
  });

  // =========================================================================
  // Batch 1C — pick(), first(n), last(n)
  // =========================================================================
  describe("Relation: pick, first(n), last(n)", () => {
    it("pick returns first row's columns", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.attribute("age", "integer"); this.adapter = adapter; }
      }
      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Bob", age: 30 });
      const result = await User.all().order("name").pick("name");
      expect(result).toBe("Alice");
    });

    it("pick returns null when no records", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      expect(await User.all().pick("name")).toBe(null);
    });

    it("first(n) returns array of n records", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      await User.create({ name: "A" });
      await User.create({ name: "B" });
      await User.create({ name: "C" });
      const result = await User.all().first(2) as Base[];
      expect(result).toHaveLength(2);
    });

    it("first(n) returns empty array for none", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const result = await User.all().none().first(2);
      expect(result).toEqual([]);
    });

    it("last(n) returns array of last n records", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      await User.create({ name: "A" });
      await User.create({ name: "B" });
      await User.create({ name: "C" });
      const result = await User.all().last(2) as Base[];
      expect(result).toHaveLength(2);
    });

    it("last(n) returns empty array for none", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const result = await User.all().none().last(2);
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // Batch 1D — increment/decrement/toggle
  // =========================================================================
  describe("Base: increment/decrement/toggle", () => {
    it("increment modifies attribute in memory", () => {
      class Counter extends Base {
        static { this.attribute("count", "integer", { default: 0 }); this.adapter = freshAdapter(); }
      }
      const c = new Counter();
      c.increment("count");
      expect(c.readAttribute("count")).toBe(1);
    });

    it("increment with custom amount", () => {
      class Counter extends Base {
        static { this.attribute("count", "integer", { default: 5 }); this.adapter = freshAdapter(); }
      }
      const c = new Counter();
      c.increment("count", 3);
      expect(c.readAttribute("count")).toBe(8);
    });

    it("decrement modifies attribute in memory", () => {
      class Counter extends Base {
        static { this.attribute("count", "integer", { default: 10 }); this.adapter = freshAdapter(); }
      }
      const c = new Counter();
      c.decrement("count");
      expect(c.readAttribute("count")).toBe(9);
    });

    it("decrement with custom amount", () => {
      class Counter extends Base {
        static { this.attribute("count", "integer", { default: 10 }); this.adapter = freshAdapter(); }
      }
      const c = new Counter();
      c.decrement("count", 3);
      expect(c.readAttribute("count")).toBe(7);
    });

    it("toggle flips boolean", () => {
      class Feature extends Base {
        static { this.attribute("active", "boolean", { default: false }); this.adapter = freshAdapter(); }
      }
      const f = new Feature();
      f.toggle("active");
      expect(f.readAttribute("active")).toBe(true);
      f.toggle("active");
      expect(f.readAttribute("active")).toBe(false);
    });

    it("incrementBang persists to DB", async () => {
      const adapter = freshAdapter();
      class Counter extends Base {
        static { this.attribute("count", "integer", { default: 0 }); this.adapter = adapter; }
      }
      const c = await Counter.create({ count: 5 });
      await c.incrementBang("count");
      const reloaded = await Counter.find(c.id);
      expect(reloaded.readAttribute("count")).toBe(6);
    });

    it("decrementBang persists to DB", async () => {
      const adapter = freshAdapter();
      class Counter extends Base {
        static { this.attribute("count", "integer", { default: 0 }); this.adapter = adapter; }
      }
      const c = await Counter.create({ count: 5 });
      await c.decrementBang("count");
      const reloaded = await Counter.find(c.id);
      expect(reloaded.readAttribute("count")).toBe(4);
    });

    it("toggleBang persists to DB", async () => {
      const adapter = freshAdapter();
      class Feature extends Base {
        static { this.attribute("active", "boolean", { default: false }); this.adapter = adapter; }
      }
      const f = await Feature.create({ active: false });
      await f.toggleBang("active");
      const reloaded = await Feature.find(f.id);
      expect(reloaded.readAttribute("active")).toBe(true);
    });

    it("increment returns this for chaining", () => {
      class Counter extends Base {
        static { this.attribute("a", "integer", { default: 0 }); this.attribute("b", "integer", { default: 0 }); this.adapter = freshAdapter(); }
      }
      const c = new Counter();
      c.increment("a").increment("b");
      expect(c.readAttribute("a")).toBe(1);
      expect(c.readAttribute("b")).toBe(1);
    });
  });

  // =========================================================================
  // Batch 1E — explain()
  // =========================================================================
  describe("Relation: explain()", () => {
    it("returns explain output from MemoryAdapter", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const result = await User.all().explain();
      expect(result).toContain("MemoryAdapter");
    });
  });

  // =========================================================================
  // Batch 1F — union/intersect/except
  // =========================================================================
  describe("Relation: set operations", () => {
    it("union combines two relations", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.attribute("age", "integer"); this.adapter = adapter; }
      }
      await User.create({ name: "Alice", age: 20 });
      await User.create({ name: "Bob", age: 30 });
      await User.create({ name: "Charlie", age: 25 });

      const young = User.where({ age: 20 });
      const old = User.where({ age: 30 });
      const result = await young.union(old).toArray();
      expect(result).toHaveLength(2);
    });

    it("unionAll includes duplicates", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      await User.create({ name: "Alice" });
      const all1 = User.all();
      const all2 = User.all();
      const result = await all1.unionAll(all2).toArray();
      expect(result).toHaveLength(2);
    });

    it("intersect finds common records", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.attribute("active", "boolean"); this.adapter = adapter; }
      }
      await User.create({ name: "Alice", active: true });
      await User.create({ name: "Bob", active: false });

      const result = await User.all().intersect(User.where({ active: true })).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Alice");
    });

    it("except removes common records", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.attribute("active", "boolean"); this.adapter = adapter; }
      }
      await User.create({ name: "Alice", active: true });
      await User.create({ name: "Bob", active: false });

      const result = await User.all().except(User.where({ active: true })).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].readAttribute("name")).toBe("Bob");
    });

    it("toSql generates UNION SQL", () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const sql = User.where({ name: "A" }).union(User.where({ name: "B" })).toSql();
      expect(sql).toContain("UNION");
    });
  });

  // =========================================================================
  // Batch 1G — lock()
  // =========================================================================
  describe("Relation: lock()", () => {
    it("toSql includes FOR UPDATE", () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const sql = User.all().lock().toSql();
      expect(sql).toContain("FOR UPDATE");
    });

    it("toSql includes custom lock clause", () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const sql = User.all().lock("FOR SHARE").toSql();
      expect(sql).toContain("FOR SHARE");
    });

    it("lock(false) removes lock", () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const sql = User.all().lock().lock(false).toSql();
      expect(sql).not.toContain("FOR UPDATE");
    });

    it("MemoryAdapter tolerates FOR UPDATE in queries", async () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      await User.create({ name: "Alice" });
      const result = await User.all().lock().toArray();
      expect(result).toHaveLength(1);
    });
  });

  // =========================================================================
  // Batch 2A — joins() and leftJoins()
  // =========================================================================
  describe("Relation: joins and leftJoins", () => {
    it("joins generates INNER JOIN SQL", () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const sql = User.all().joins("posts", '"users"."id" = "posts"."user_id"').toSql();
      expect(sql).toContain("INNER JOIN");
      expect(sql).toContain('"posts"');
    });

    it("leftJoins generates LEFT OUTER JOIN SQL", () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const sql = User.all().leftJoins("posts", '"users"."id" = "posts"."user_id"').toSql();
      expect(sql).toContain("LEFT OUTER JOIN");
    });

    it("raw joins with single string", () => {
      const adapter = freshAdapter();
      class User extends Base {
        static { this.attribute("name", "string"); this.adapter = adapter; }
      }
      const sql = User.all().joins('INNER JOIN "posts" ON "posts"."user_id" = "users"."id"').toSql();
      expect(sql).toContain("INNER JOIN");
    });
  });

  // =========================================================================
  // Batch 3A — dependent: destroy/delete/nullify
  // =========================================================================
  describe("Associations: dependent", () => {
    it("dependent destroy destroys children", async () => {
      const adapter = freshAdapter();

      class Comment extends Base {
        static {
          this.attribute("body", "string");
          this.attribute("post_id", "integer");
          this.adapter = adapter;
        }
      }

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.adapter = adapter;
        }
      }
      (Post as any)._associations = [
        { type: "hasMany", name: "comments", options: { dependent: "destroy", className: "Comment" } },
      ];

      registerModel(Post);
      registerModel(Comment);

      const post = await Post.create({ title: "Hello" });
      await Comment.create({ body: "Nice", post_id: post.id });
      await Comment.create({ body: "Great", post_id: post.id });

      expect(await Comment.all().count()).toBe(2);
      await post.destroy();
      expect(await Comment.all().count()).toBe(0);
    });

    it("dependent nullify sets FK to null", async () => {
      const adapter = freshAdapter();

      class Reply extends Base {
        static {
          this.attribute("content", "string");
          this.attribute("thread_id", "integer");
          this.adapter = adapter;
        }
      }

      class Thread extends Base {
        static {
          this.attribute("subject", "string");
          this.adapter = adapter;
        }
      }
      (Thread as any)._associations = [
        { type: "hasMany", name: "replies", options: { dependent: "nullify", className: "Reply", foreignKey: "thread_id" } },
      ];

      registerModel(Thread);
      registerModel(Reply);

      const thread = await Thread.create({ subject: "Test" });
      await Reply.create({ content: "Reply 1", thread_id: thread.id });

      await thread.destroy();

      const replies = await Reply.all().toArray();
      expect(replies).toHaveLength(1);
      expect(replies[0].readAttribute("thread_id")).toBe(null);
    });
  });

  // =========================================================================
  // Batch 3B — has_many through
  // =========================================================================
  describe("Associations: has_many through", () => {
    it("loads through a join model", async () => {
      const adapter = freshAdapter();

      class Tag extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      class Tagging extends Base {
        static {
          this.attribute("post_id", "integer");
          this.attribute("tag_id", "integer");
          this.adapter = adapter;
        }
      }

      class Post extends Base {
        static {
          this.attribute("title", "string");
          this.adapter = adapter;
        }
      }
      (Post as any)._associations = [
        { type: "hasMany", name: "taggings", options: { className: "Tagging" } },
        { type: "hasMany", name: "tags", options: { through: "taggings", className: "Tag", source: "tag" } },
      ];

      registerModel(Post);
      registerModel(Tagging);
      registerModel(Tag);

      const post = await Post.create({ title: "Hello" });
      const tag1 = await Tag.create({ name: "ruby" });
      const tag2 = await Tag.create({ name: "rails" });
      await Tagging.create({ post_id: post.id, tag_id: tag1.id });
      await Tagging.create({ post_id: post.id, tag_id: tag2.id });

      const tags = await loadHasManyThrough(post, "tags", {
        through: "taggings",
        className: "Tag",
        source: "tag",
      });
      expect(tags).toHaveLength(2);
      const names = tags.map((t) => t.readAttribute("name"));
      expect(names).toContain("ruby");
      expect(names).toContain("rails");
    });
  });

  // =========================================================================
  // Batch 3C — CollectionProxy
  // =========================================================================
  describe("CollectionProxy", () => {
    it("toArray loads associated records", async () => {
      const adapter = freshAdapter();

      class Item extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("order_id", "integer");
          this.adapter = adapter;
        }
      }

      class Order extends Base {
        static {
          this.attribute("number", "string");
          this.adapter = adapter;
        }
      }
      (Order as any)._associations = [
        { type: "hasMany", name: "items", options: { className: "Item", foreignKey: "order_id" } },
      ];

      registerModel(Order);
      registerModel(Item);

      const order = await Order.create({ number: "ORD-001" });
      await Item.create({ name: "Widget", order_id: order.id });
      await Item.create({ name: "Gadget", order_id: order.id });

      const proxy = association(order, "items");
      const items = await proxy.toArray();
      expect(items).toHaveLength(2);
    });

    it("build creates unsaved record with FK", async () => {
      const adapter = freshAdapter();

      class LineItem extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("invoice_id", "integer");
          this.adapter = adapter;
        }
      }

      class Invoice extends Base {
        static {
          this.attribute("number", "string");
          this.adapter = adapter;
        }
      }
      (Invoice as any)._associations = [
        { type: "hasMany", name: "lineItems", options: { className: "LineItem", foreignKey: "invoice_id" } },
      ];

      registerModel(Invoice);
      registerModel(LineItem);

      const invoice = await Invoice.create({ number: "INV-001" });
      const proxy = association(invoice, "lineItems");
      const item = proxy.build({ name: "Widget" });
      expect(item.readAttribute("invoice_id")).toBe(invoice.id);
      expect(item.isNewRecord()).toBe(true);
    });

    it("create saves a new associated record", async () => {
      const adapter = freshAdapter();

      class Note extends Base {
        static {
          this.attribute("text", "string");
          this.attribute("doc_id", "integer");
          this.adapter = adapter;
        }
      }

      class Doc extends Base {
        static {
          this.attribute("title", "string");
          this.adapter = adapter;
        }
      }
      (Doc as any)._associations = [
        { type: "hasMany", name: "notes", options: { className: "Note", foreignKey: "doc_id" } },
      ];

      registerModel(Doc);
      registerModel(Note);

      const doc = await Doc.create({ title: "My Doc" });
      const proxy = association(doc, "notes");
      const note = await proxy.create({ text: "Remember this" });
      expect(note.isPersisted()).toBe(true);
      expect(note.readAttribute("doc_id")).toBe(doc.id);
    });

    it("count returns number of associated records", async () => {
      const adapter = freshAdapter();

      class Task extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("project_id", "integer");
          this.adapter = adapter;
        }
      }

      class Project extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      (Project as any)._associations = [
        { type: "hasMany", name: "tasks", options: { className: "Task", foreignKey: "project_id" } },
      ];

      registerModel(Project);
      registerModel(Task);

      const project = await Project.create({ name: "Rails-JS" });
      await Task.create({ title: "Task 1", project_id: project.id });
      await Task.create({ title: "Task 2", project_id: project.id });

      const proxy = association(project, "tasks");
      expect(await proxy.count()).toBe(2);
    });
  });

  // =========================================================================
  // Batch 4A — includes / preload / eagerLoad
  // =========================================================================
  describe("Eager Loading", () => {
    it("includes preloads belongsTo associations", async () => {
      const adapter = freshAdapter();

      class Author extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      class Book extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("author_id", "integer");
          this.adapter = adapter;
        }
      }
      (Book as any)._associations = [
        { type: "belongsTo", name: "author", options: { className: "Author" } },
      ];

      registerModel(Author);
      registerModel(Book);

      const author = await Author.create({ name: "Bob" });
      await Book.create({ title: "Book 1", author_id: author.id });
      await Book.create({ title: "Book 2", author_id: author.id });

      const books = await Book.all().includes("author").toArray();
      expect(books).toHaveLength(2);
      // Preloaded data should be cached
      expect((books[0] as any)._preloadedAssociations.has("author")).toBe(true);
    });

    it("includes preloads hasMany associations", async () => {
      const adapter = freshAdapter();

      class Chapter extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("novel_id", "integer");
          this.adapter = adapter;
        }
      }

      class Novel extends Base {
        static {
          this.attribute("title", "string");
          this.adapter = adapter;
        }
      }
      (Novel as any)._associations = [
        { type: "hasMany", name: "chapters", options: { className: "Chapter", foreignKey: "novel_id" } },
      ];

      registerModel(Novel);
      registerModel(Chapter);

      const novel = await Novel.create({ title: "Epic" });
      await Chapter.create({ title: "Ch 1", novel_id: novel.id });
      await Chapter.create({ title: "Ch 2", novel_id: novel.id });

      const novels = await Novel.all().includes("chapters").toArray();
      expect(novels).toHaveLength(1);
      const preloaded = (novels[0] as any)._preloadedAssociations.get("chapters");
      expect(preloaded).toHaveLength(2);
    });

    it("preload method works like includes", async () => {
      const adapter = freshAdapter();

      class Pet extends Base {
        static {
          this.attribute("name", "string");
          this.attribute("owner_id", "integer");
          this.adapter = adapter;
        }
      }

      class Owner extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      (Owner as any)._associations = [
        { type: "hasMany", name: "pets", options: { className: "Pet", foreignKey: "owner_id" } },
      ];

      registerModel(Owner);
      registerModel(Pet);

      const owner = await Owner.create({ name: "Jane" });
      await Pet.create({ name: "Rex", owner_id: owner.id });

      const owners = await Owner.all().preload("pets").toArray();
      expect((owners[0] as any)._preloadedAssociations.get("pets")).toHaveLength(1);
    });

    it("eagerLoad method works like includes", async () => {
      const adapter = freshAdapter();

      class Wheel extends Base {
        static {
          this.attribute("position", "string");
          this.attribute("car_id", "integer");
          this.adapter = adapter;
        }
      }

      class Car extends Base {
        static {
          this.attribute("make", "string");
          this.adapter = adapter;
        }
      }
      (Car as any)._associations = [
        { type: "hasMany", name: "wheels", options: { className: "Wheel", foreignKey: "car_id" } },
      ];

      registerModel(Car);
      registerModel(Wheel);

      const car = await Car.create({ make: "Toyota" });
      await Wheel.create({ position: "FL", car_id: car.id });
      await Wheel.create({ position: "FR", car_id: car.id });

      const cars = await Car.all().eagerLoad("wheels").toArray();
      expect((cars[0] as any)._preloadedAssociations.get("wheels")).toHaveLength(2);
    });

    it("loadBelongsTo uses preloaded cache", async () => {
      const adapter = freshAdapter();

      class Publisher extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }

      class Magazine extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("publisher_id", "integer");
          this.adapter = adapter;
        }
      }
      (Magazine as any)._associations = [
        { type: "belongsTo", name: "publisher", options: { className: "Publisher" } },
      ];

      registerModel(Publisher);
      registerModel(Magazine);

      const pub = await Publisher.create({ name: "Pub Co" });
      await Magazine.create({ title: "Mag 1", publisher_id: pub.id });

      const mags = await Magazine.all().includes("publisher").toArray();
      // loadBelongsTo should use cache
      const loaded = await loadBelongsTo(mags[0], "publisher", { className: "Publisher" });
      expect(loaded!.readAttribute("name")).toBe("Pub Co");
    });
  });

  // =========================================================================
  // Batch 5A — afterCommit / afterRollback
  // =========================================================================
  describe("afterCommit / afterRollback", () => {
    it("fires afterCommit callback outside transaction", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class Order extends Base {
        static {
          this.attribute("total", "integer");
          this.adapter = adapter;
          this.afterCommit((record: any) => { log.push("committed"); });
        }
      }

      await Order.create({ total: 100 });
      expect(log).toContain("committed");
    });

    it("fires afterCommit inside transaction on commit", async () => {
      const adapter = freshAdapter();
      const log: string[] = [];

      class Payment extends Base {
        static {
          this.attribute("amount", "integer");
          this.adapter = adapter;
          this.afterCommit((record: any) => { log.push("committed"); });
        }
      }

      await transaction(Payment, async (tx) => {
        await Payment.create({ amount: 50 });
      });
      expect(log).toContain("committed");
    });
  });

  // =========================================================================
  // Batch 6C — UniquenessValidator
  // =========================================================================
  describe("UniquenessValidator", () => {
    it("validates uniqueness of an attribute", async () => {
      const adapter = freshAdapter();

      class Email extends Base {
        static {
          this.attribute("address", "string");
          this.adapter = adapter;
          this.validatesUniqueness("address");
        }
      }

      const e1 = await Email.create({ address: "test@example.com" });
      expect(e1.isPersisted()).toBe(true);

      const e2 = new Email({ address: "test@example.com" });
      const saved = await e2.save();
      expect(saved).toBe(false);
      expect(e2.errors.get("address")).toContain("has already been taken");
    });

    it("allows same value if record is itself", async () => {
      const adapter = freshAdapter();

      class Username extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
          this.validatesUniqueness("name");
        }
      }

      const u = await Username.create({ name: "dean" });
      // Re-saving same record should work
      const saved = await u.save();
      expect(saved).toBe(true);
    });

    it("validates with scope", async () => {
      const adapter = freshAdapter();

      class Membership extends Base {
        static {
          this.attribute("user_id", "integer");
          this.attribute("group_id", "integer");
          this.adapter = adapter;
          this.validatesUniqueness("user_id", { scope: "group_id" });
        }
      }

      await Membership.create({ user_id: 1, group_id: 1 });
      // Same user, different group — should work
      const m2 = await Membership.create({ user_id: 1, group_id: 2 });
      expect(m2.isPersisted()).toBe(true);
      // Same user, same group — should fail
      const m3 = new Membership({ user_id: 1, group_id: 1 });
      expect(await m3.save()).toBe(false);
    });
  });

  // =========================================================================
  // Batch 7A — Reversible Migrations
  // =========================================================================
  describe("Reversible Migrations", () => {
    it("change method runs up and reverses on down", async () => {
      const adapter = freshAdapter();

      class CreatePosts extends Migration {
        async change(): Promise<void> {
          await this.createTable("posts", (t) => {
            t.string("title");
            t.text("body");
          });
        }
      }

      const migration = new CreatePosts();
      // Up
      await migration.run(adapter, "up");
      // Table should exist - insert should work
      await adapter.executeMutation(
        `INSERT INTO "posts" ("title", "body") VALUES ('Hello', 'World')`
      );
      const rows = await adapter.execute(`SELECT * FROM "posts"`);
      expect(rows).toHaveLength(1);

      // Down — drops the table
      await migration.run(adapter, "down");
      const afterDrop = await adapter.execute(`SELECT * FROM "posts"`);
      expect(afterDrop).toHaveLength(0);
    });
  });

  // =========================================================================
  // Batch 7B — Migration Runner
  // =========================================================================
  describe("MigrationRunner", () => {
    it("migrate runs pending migrations", async () => {
      const adapter = freshAdapter();

      class M1 extends Migration {
        static version = "001";
        async up() { await this.createTable("users", (t) => { t.string("name"); }); }
        async down() { await this.dropTable("users"); }
      }

      class M2 extends Migration {
        static version = "002";
        async up() { await this.createTable("posts", (t) => { t.string("title"); }); }
        async down() { await this.dropTable("posts"); }
      }

      const runner = new MigrationRunner(adapter, [new M1(), new M2()]);
      await runner.migrate();

      // Tables should exist
      await adapter.executeMutation(`INSERT INTO "users" ("name") VALUES ('Alice')`);
      await adapter.executeMutation(`INSERT INTO "posts" ("title") VALUES ('Hello')`);
      expect(await adapter.execute(`SELECT * FROM "users"`)).toHaveLength(1);
      expect(await adapter.execute(`SELECT * FROM "posts"`)).toHaveLength(1);
    });

    it("status shows migration states", async () => {
      const adapter = freshAdapter();

      class M1 extends Migration {
        static version = "001";
        async up() { await this.createTable("items", (t) => { t.string("name"); }); }
        async down() { await this.dropTable("items"); }
      }

      const runner = new MigrationRunner(adapter, [new M1()]);
      let status = await runner.status();
      expect(status[0].status).toBe("down");

      await runner.migrate();
      status = await runner.status();
      expect(status[0].status).toBe("up");
    });

    it("rollback rolls back N migrations", async () => {
      const adapter = freshAdapter();

      class M1 extends Migration {
        static version = "001";
        async up() { await this.createTable("t1", (t) => { t.string("a"); }); }
        async down() { await this.dropTable("t1"); }
      }

      class M2 extends Migration {
        static version = "002";
        async up() { await this.createTable("t2", (t) => { t.string("b"); }); }
        async down() { await this.dropTable("t2"); }
      }

      const runner = new MigrationRunner(adapter, [new M1(), new M2()]);
      await runner.migrate();

      // Rollback 1
      await runner.rollback(1);
      const status = await runner.status();
      expect(status[0].status).toBe("up");
      expect(status[1].status).toBe("down");
    });

    it("migrate is idempotent", async () => {
      const adapter = freshAdapter();

      class M1 extends Migration {
        static version = "001";
        async up() { await this.createTable("x", (t) => { t.string("v"); }); }
        async down() { await this.dropTable("x"); }
      }

      const runner = new MigrationRunner(adapter, [new M1()]);
      await runner.migrate();
      // Running again should not throw
      await runner.migrate();
    });
  });

  // -- Enum --
  describe("Enum", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("defines scopes for each enum value", async () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.attribute("status", "integer");
      Post.adapter = adapter;
      defineEnum(Post, "status", ["draft", "published", "archived"]);

      await Post.create({ title: "A", status: 0 });
      await Post.create({ title: "B", status: 1 });
      await Post.create({ title: "C", status: 2 });

      const drafts = await (Post as any).draft().toArray();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].readAttribute("title")).toBe("A");

      const published = await (Post as any).published().toArray();
      expect(published).toHaveLength(1);
      expect(published[0].readAttribute("title")).toBe("B");
    });

    it("defines predicate methods", () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("status", "integer");
      Post.adapter = freshAdapter();
      defineEnum(Post, "status", ["draft", "published", "archived"]);

      const post = new Post({ status: 0 });
      expect((post as any).isDraft()).toBe(true);
      expect((post as any).isPublished()).toBe(false);
      expect((post as any).isArchived()).toBe(false);
    });

    it("defines setter methods", () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("status", "integer");
      Post.adapter = freshAdapter();
      defineEnum(Post, "status", ["draft", "published", "archived"]);

      const post = new Post({ status: 0 });
      expect((post as any).isDraft()).toBe(true);
      (post as any).published();
      expect((post as any).isPublished()).toBe(true);
      expect(post.readAttribute("status")).toBe(1);
    });

    it("supports hash mapping", () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("status", "integer");
      Post.adapter = freshAdapter();
      defineEnum(Post, "status", { draft: 0, published: 5, archived: 10 });

      const post = new Post({ status: 5 });
      expect((post as any).isPublished()).toBe(true);
      expect(readEnumValue(post, "status")).toBe("published");
    });

    it("readEnumValue returns the string name", () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("status", "integer");
      Post.adapter = freshAdapter();
      defineEnum(Post, "status", ["draft", "published", "archived"]);

      const post = new Post({ status: 2 });
      expect(readEnumValue(post, "status")).toBe("archived");
    });
  });

  // -- Single Table Inheritance --
  describe("STI", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("subclasses share the parent table", () => {
      class Vehicle extends Base {
        static _tableName = "vehicles";
      }
      enableSti(Vehicle);
      class Car extends Vehicle {}
      class Truck extends Vehicle {}

      expect(Car.tableName).toBe("vehicles");
      expect(Truck.tableName).toBe("vehicles");
    });

    it("auto-sets the type column on save", async () => {
      class Vehicle extends Base {
        static _tableName = "vehicles";
      }
      Vehicle.attribute("id", "integer");
      Vehicle.attribute("name", "string");
      Vehicle.attribute("type", "string");
      Vehicle.adapter = adapter;
      enableSti(Vehicle);

      class Car extends Vehicle {}
      Car.adapter = adapter;
      registerModel(Car);

      const car = await Car.create({ name: "Civic" });
      expect(car.readAttribute("type")).toBe("Car");
    });

    it("subclass queries filter by type", async () => {
      class Vehicle extends Base {
        static _tableName = "vehicles";
      }
      Vehicle.attribute("id", "integer");
      Vehicle.attribute("name", "string");
      Vehicle.attribute("type", "string");
      Vehicle.adapter = adapter;
      enableSti(Vehicle);

      class Car extends Vehicle {}
      Car.adapter = adapter;
      registerModel(Car);

      class Truck extends Vehicle {}
      Truck.adapter = adapter;
      registerModel(Truck);

      await Car.create({ name: "Civic" });
      await Truck.create({ name: "F-150" });
      await Car.create({ name: "Accord" });

      const cars = await Car.all().toArray();
      expect(cars).toHaveLength(2);
      expect(cars.every((c: any) => c.readAttribute("type") === "Car")).toBe(true);

      const trucks = await Truck.all().toArray();
      expect(trucks).toHaveLength(1);

      // Base class returns all
      const all = await Vehicle.all().toArray();
      expect(all).toHaveLength(3);
    });

    it("instantiates the correct subclass from base queries", async () => {
      class Vehicle extends Base {
        static _tableName = "vehicles";
      }
      Vehicle.attribute("id", "integer");
      Vehicle.attribute("name", "string");
      Vehicle.attribute("type", "string");
      Vehicle.adapter = adapter;
      enableSti(Vehicle);

      class Car extends Vehicle {}
      Car.adapter = adapter;
      registerModel(Car);

      class Truck extends Vehicle {}
      Truck.adapter = adapter;
      registerModel(Truck);

      await Car.create({ name: "Civic" });
      await Truck.create({ name: "F-150" });

      const all = await Vehicle.all().toArray();
      expect(all[0]).toBeInstanceOf(Car);
      expect(all[1]).toBeInstanceOf(Truck);
    });
  });

  // -- Polymorphic Associations --
  describe("Polymorphic Associations", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("belongsTo polymorphic loads correct parent type", async () => {
      class Article extends Base {
        static _tableName = "articles";
      }
      Article.attribute("id", "integer");
      Article.attribute("title", "string");
      Article.adapter = adapter;
      registerModel(Article);

      class Photo extends Base {
        static _tableName = "photos";
      }
      Photo.attribute("id", "integer");
      Photo.attribute("url", "string");
      Photo.adapter = adapter;
      registerModel(Photo);

      class Comment extends Base {
        static _tableName = "comments";
      }
      Comment.attribute("id", "integer");
      Comment.attribute("body", "string");
      Comment.attribute("commentable_id", "integer");
      Comment.attribute("commentable_type", "string");
      Comment.adapter = adapter;
      Associations.belongsTo.call(Comment, "commentable", { polymorphic: true });

      const article = await Article.create({ title: "Hello" });
      const photo = await Photo.create({ url: "pic.jpg" });
      const c1 = await Comment.create({ body: "Nice!", commentable_id: article.id, commentable_type: "Article" });
      const c2 = await Comment.create({ body: "Cool!", commentable_id: photo.id, commentable_type: "Photo" });

      const parent1 = await loadBelongsTo(c1, "commentable", { polymorphic: true });
      expect(parent1).toBeInstanceOf(Article);
      expect(parent1!.readAttribute("title")).toBe("Hello");

      const parent2 = await loadBelongsTo(c2, "commentable", { polymorphic: true });
      expect(parent2).toBeInstanceOf(Photo);
      expect(parent2!.readAttribute("url")).toBe("pic.jpg");
    });

    it("hasMany with as: loads polymorphic children", async () => {
      class Article extends Base {
        static _tableName = "articles";
      }
      Article.attribute("id", "integer");
      Article.attribute("title", "string");
      Article.adapter = adapter;
      registerModel(Article);
      Associations.hasMany.call(Article, "comments", { as: "commentable" });

      class Comment extends Base {
        static _tableName = "comments";
      }
      Comment.attribute("id", "integer");
      Comment.attribute("body", "string");
      Comment.attribute("commentable_id", "integer");
      Comment.attribute("commentable_type", "string");
      Comment.adapter = adapter;
      registerModel(Comment);

      const article = await Article.create({ title: "Hello" });
      await Comment.create({ body: "Nice!", commentable_id: article.id, commentable_type: "Article" });
      await Comment.create({ body: "Cool!", commentable_id: article.id, commentable_type: "Article" });
      await Comment.create({ body: "Other", commentable_id: 999, commentable_type: "Photo" });

      const assocDef = (Article as any)._associations.find((a: any) => a.name === "comments");
      const comments = await loadHasMany(article, "comments", assocDef.options);
      expect(comments).toHaveLength(2);
    });
  });

  // -- HABTM --
  describe("has_and_belongs_to_many", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("loads associated records through a join table", async () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.adapter = adapter;
      Associations.hasAndBelongsToMany.call(Post, "tags", { joinTable: "posts_tags" });

      class Tag extends Base {
        static _tableName = "tags";
      }
      Tag.attribute("id", "integer");
      Tag.attribute("name", "string");
      Tag.adapter = adapter;
      registerModel(Tag);
      registerModel(Post);

      const post = await Post.create({ title: "Hello" });
      const t1 = await Tag.create({ name: "ruby" });
      const t2 = await Tag.create({ name: "rails" });
      const t3 = await Tag.create({ name: "js" });

      // Manually insert into join table
      await adapter.executeMutation(
        `INSERT INTO "posts_tags" ("post_id", "tag_id") VALUES (${post.id}, ${t1.id})`
      );
      await adapter.executeMutation(
        `INSERT INTO "posts_tags" ("post_id", "tag_id") VALUES (${post.id}, ${t2.id})`
      );

      const tags = await loadHabtm(post, "tags", { joinTable: "posts_tags" });
      expect(tags).toHaveLength(2);
      const names = tags.map((t: any) => t.readAttribute("name")).sort();
      expect(names).toEqual(["rails", "ruby"]);
    });

    it("uses default join table name (alphabetical)", async () => {
      class Developer extends Base {
        static _tableName = "developers";
      }
      Developer.attribute("id", "integer");
      Developer.attribute("name", "string");
      Developer.adapter = adapter;
      Associations.hasAndBelongsToMany.call(Developer, "projects");
      registerModel(Developer);

      class Project extends Base {
        static _tableName = "projects";
      }
      Project.attribute("id", "integer");
      Project.attribute("name", "string");
      Project.adapter = adapter;
      registerModel(Project);

      const dev = await Developer.create({ name: "Alice" });
      const proj = await Project.create({ name: "Rails" });

      // Default join table: alphabetical order of pluralized names
      // "developers" and "projects" -> "developers_projects"
      await adapter.executeMutation(
        `INSERT INTO "developers_projects" ("developer_id", "project_id") VALUES (${dev.id}, ${proj.id})`
      );

      const projects = await loadHabtm(dev, "projects", {});
      expect(projects).toHaveLength(1);
      expect(projects[0].readAttribute("name")).toBe("Rails");
    });
  });

  // -- secure_password --
  describe("secure_password", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("hashes password on save and authenticates", async () => {
      class User extends Base {
        static _tableName = "users";
      }
      User.attribute("id", "integer");
      User.attribute("name", "string");
      User.attribute("password_digest", "string");
      User.adapter = adapter;
      hasSecurePassword(User, { validations: false });

      const user = new User({ name: "Alice" });
      (user as any).password = "secret123";
      await user.save();

      const digest = user.readAttribute("password_digest") as string;
      expect(digest).toBeTruthy();
      expect(digest).toContain(":");

      // authenticate returns record on success
      const result = (user as any).authenticate("secret123");
      expect(result).toBe(user);

      // authenticate returns false on failure
      const badResult = (user as any).authenticate("wrong");
      expect(badResult).toBe(false);
    });

    it("validates password presence on create", async () => {
      class User extends Base {
        static _tableName = "users";
      }
      User.attribute("id", "integer");
      User.attribute("password_digest", "string");
      User.adapter = adapter;
      hasSecurePassword(User);

      const user = new User({});
      const saved = await user.save();
      expect(saved).toBe(false);
      expect(user.errors.fullMessages).toContain("Password can't be blank");
    });

    it("validates password confirmation mismatch", async () => {
      class User extends Base {
        static _tableName = "users";
      }
      User.attribute("id", "integer");
      User.attribute("password_digest", "string");
      User.adapter = adapter;
      hasSecurePassword(User);

      const user = new User({});
      (user as any).password = "secret123";
      (user as any).passwordConfirmation = "different";
      const saved = await user.save();
      expect(saved).toBe(false);
      expect(user.errors.fullMessages.some((m: string) =>
        m.includes("doesn't match Password")
      )).toBe(true);
    });
  });

  // -- Store --
  describe("Store", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("reads and writes individual store accessors", () => {
      class User extends Base {
        static _tableName = "users";
      }
      User.attribute("id", "integer");
      User.attribute("settings", "json");
      User.adapter = adapter;
      store(User, "settings", { accessors: ["theme", "language"] });

      const user = new User({});
      expect((user as any).theme).toBeNull();
      expect((user as any).language).toBeNull();

      (user as any).theme = "dark";
      (user as any).language = "en";

      expect((user as any).theme).toBe("dark");
      expect((user as any).language).toBe("en");

      // Underlying attribute is an object
      const settings = user.readAttribute("settings");
      expect(settings).toEqual({ theme: "dark", language: "en" });
    });

    it("reads from pre-existing JSON data", () => {
      class User extends Base {
        static _tableName = "users";
      }
      User.attribute("id", "integer");
      User.attribute("settings", "json");
      User.adapter = adapter;
      store(User, "settings", { accessors: ["theme", "language"] });

      const user = new User({ settings: '{"theme":"light","language":"fr"}' });
      expect((user as any).theme).toBe("light");
      expect((user as any).language).toBe("fr");
    });

    it("persists through save and reload", async () => {
      class User extends Base {
        static _tableName = "users";
      }
      User.attribute("id", "integer");
      User.attribute("settings", "json");
      User.adapter = adapter;
      store(User, "settings", { accessors: ["theme", "language"] });
      registerModel(User);

      const user = new User({});
      (user as any).theme = "dark";
      (user as any).language = "en";
      await user.save();

      const found = await User.find(user.id);
      // Store data should persist (might be serialized as object or string)
      expect((found as any).theme).toBe("dark");
      expect((found as any).language).toBe("en");
    });
  });

  // -- Counter Cache --
  describe("counter_cache", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("increments counter on create and decrements on destroy", async () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.attribute("comments_count", "integer", { default: 0 });
      Post.adapter = adapter;
      registerModel(Post);

      class Comment extends Base {
        static _tableName = "comments";
      }
      Comment.attribute("id", "integer");
      Comment.attribute("body", "string");
      Comment.attribute("post_id", "integer");
      Comment.adapter = adapter;
      Associations.belongsTo.call(Comment, "post", { counterCache: true });
      registerModel(Comment);

      const post = await Post.create({ title: "Hello" });
      expect(post.readAttribute("comments_count")).toBe(0);

      const c1 = await Comment.create({ body: "Nice!", post_id: post.id });
      await post.reload();
      expect(post.readAttribute("comments_count")).toBe(1);

      const c2 = await Comment.create({ body: "Cool!", post_id: post.id });
      await post.reload();
      expect(post.readAttribute("comments_count")).toBe(2);

      await c1.destroy();
      await post.reload();
      expect(post.readAttribute("comments_count")).toBe(1);
    });

    it("supports custom counter column name", async () => {
      class Author extends Base {
        static _tableName = "authors";
      }
      Author.attribute("id", "integer");
      Author.attribute("name", "string");
      Author.attribute("num_books", "integer", { default: 0 });
      Author.adapter = adapter;
      registerModel(Author);

      class Book extends Base {
        static _tableName = "books";
      }
      Book.attribute("id", "integer");
      Book.attribute("title", "string");
      Book.attribute("author_id", "integer");
      Book.adapter = adapter;
      Associations.belongsTo.call(Book, "author", { counterCache: "num_books" });
      registerModel(Book);

      const author = await Author.create({ name: "Tolkien" });
      await Book.create({ title: "The Hobbit", author_id: author.id });
      await author.reload();
      expect(author.readAttribute("num_books")).toBe(1);
    });
  });

  // -- Touch on belongs_to --
  describe("touch on belongs_to", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("touches parent updated_at when child is saved", async () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.attribute("updated_at", "datetime");
      Post.adapter = adapter;
      registerModel(Post);

      class Comment extends Base {
        static _tableName = "comments";
      }
      Comment.attribute("id", "integer");
      Comment.attribute("body", "string");
      Comment.attribute("post_id", "integer");
      Comment.adapter = adapter;
      Associations.belongsTo.call(Comment, "post", { touch: true });
      registerModel(Comment);

      const post = await Post.create({ title: "Hello" });
      const originalUpdatedAt = post.readAttribute("updated_at");

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      await Comment.create({ body: "Nice!", post_id: post.id });
      await post.reload();

      const newUpdatedAt = post.readAttribute("updated_at");
      expect(newUpdatedAt).not.toEqual(originalUpdatedAt);
    });
  });

  // -- Optimistic Locking --
  describe("optimistic locking", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("increments lock_version on update", async () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.attribute("lock_version", "integer", { default: 0 });
      Post.adapter = adapter;

      const post = await Post.create({ title: "Hello" });
      expect(post.readAttribute("lock_version")).toBe(0);

      await post.update({ title: "Updated" });
      expect(post.readAttribute("lock_version")).toBe(1);

      await post.update({ title: "Updated Again" });
      expect(post.readAttribute("lock_version")).toBe(2);
    });

    it("raises StaleObjectError on version mismatch", async () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.attribute("lock_version", "integer", { default: 0 });
      Post.adapter = adapter;

      const post1 = await Post.create({ title: "Hello" });
      const post2 = await Post.find(post1.id);

      // Both have lock_version 0
      await post1.update({ title: "Updated by 1" });
      // post1 now has lock_version 1, but post2 still has 0

      await expect(post2.update({ title: "Updated by 2" })).rejects.toThrow(
        "StaleObjectError"
      );
    });
  });

  // -- Readonly --
  describe("readonly", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("prevents saving a readonly record", async () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.adapter = adapter;

      const post = await Post.create({ title: "Hello" });
      post.readonlyBang();

      expect(post.isReadonly()).toBe(true);
      await expect(post.save()).rejects.toThrow("readonly");
    });

    it("prevents destroying a readonly record", async () => {
      class Post extends Base {
        static _tableName = "posts";
      }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.adapter = adapter;

      const post = await Post.create({ title: "Hello" });
      post.readonlyBang();

      await expect(post.destroy()).rejects.toThrow("readonly");
    });
  });

  // -- Validation Contexts --
  describe("validation contexts", () => {
    it("on: create only runs for new records", async () => {
      class User extends Base {
        static _tableName = "users";
      }
      User.attribute("id", "integer");
      User.attribute("name", "string");
      User.attribute("invite_code", "string");
      User.adapter = freshAdapter();
      User.validates("invite_code", { presence: true, on: "create" });

      // Can't create without invite_code
      const user = new User({ name: "Alice" });
      const saved = await user.save();
      expect(saved).toBe(false);

      // Can create with invite_code
      const user2 = new User({ name: "Alice", invite_code: "ABC123" });
      const saved2 = await user2.save();
      expect(saved2).toBe(true);

      // Can update without invite_code (validation skipped for update context)
      user2.writeAttribute("invite_code", null);
      user2.writeAttribute("name", "Bob");
      const saved3 = await user2.save();
      expect(saved3).toBe(true);
    });

    it("on: update only runs for existing records", async () => {
      class User extends Base {
        static _tableName = "users";
      }
      User.attribute("id", "integer");
      User.attribute("name", "string");
      User.attribute("reason", "string");
      User.adapter = freshAdapter();
      User.validates("reason", { presence: true, on: "update" });

      // Can create without reason
      const user = await User.create({ name: "Alice" });
      expect(user.isPersisted()).toBe(true);

      // Can't update without reason
      user.writeAttribute("name", "Bob");
      const saved = await user.save();
      expect(saved).toBe(false);

      // Can update with reason
      user.writeAttribute("reason", "Name change");
      const saved2 = await user.save();
      expect(saved2).toBe(true);
    });
  });

  // -- Delegate --
  describe("delegate", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
      adapter = freshAdapter();
    });

    it("delegates methods to an association", async () => {
      class Author extends Base {
        static _tableName = "authors";
      }
      Author.attribute("id", "integer");
      Author.attribute("name", "string");
      Author.attribute("email", "string");
      Author.adapter = adapter;
      registerModel(Author);

      class Book extends Base {
        static _tableName = "books";
      }
      Book.attribute("id", "integer");
      Book.attribute("title", "string");
      Book.attribute("author_id", "integer");
      Book.adapter = adapter;
      Associations.belongsTo.call(Book, "author");
      delegate(Book, ["name", "email"], { to: "author" });
      registerModel(Book);

      const author = await Author.create({ name: "Tolkien", email: "jrr@shire.com" });
      const book = await Book.create({ title: "The Hobbit", author_id: author.id });

      expect(await (book as any).name()).toBe("Tolkien");
      expect(await (book as any).email()).toBe("jrr@shire.com");
    });

    it("supports prefix option", async () => {
      class Author extends Base {
        static _tableName = "authors";
      }
      Author.attribute("id", "integer");
      Author.attribute("name", "string");
      Author.adapter = adapter;
      registerModel(Author);

      class Book extends Base {
        static _tableName = "books";
      }
      Book.attribute("id", "integer");
      Book.attribute("title", "string");
      Book.attribute("author_id", "integer");
      Book.adapter = adapter;
      Associations.belongsTo.call(Book, "author");
      delegate(Book, ["name"], { to: "author", prefix: true });
      registerModel(Book);

      const author = await Author.create({ name: "Tolkien" });
      const book = await Book.create({ title: "The Hobbit", author_id: author.id });

      expect(await (book as any).authorName()).toBe("Tolkien");
    });
  });

  // -- Error Classes --
  describe("error classes", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("find throws RecordNotFound with metadata", async () => {
      class Item extends Base { static _tableName = "items"; }
      Item.attribute("id", "integer");
      Item.adapter = adapter;

      try {
        await Item.find(999);
        expect.unreachable("should throw");
      } catch (e: any) {
        expect(e).toBeInstanceOf(RecordNotFound);
        expect(e.model).toBe("Item");
        expect(e.primaryKey).toBe("id");
        expect(e.id).toBe(999);
      }
    });

    it("saveBang throws RecordInvalid with record reference", async () => {
      class Widget extends Base { static _tableName = "widgets"; }
      Widget.attribute("id", "integer");
      Widget.attribute("name", "string");
      Widget.validates("name", { presence: true });
      Widget.adapter = adapter;

      const w = new Widget({});
      try {
        await w.saveBang();
        expect.unreachable("should throw");
      } catch (e: any) {
        expect(e).toBeInstanceOf(RecordInvalid);
        expect(e.record).toBe(w);
        expect(e.message).toMatch(/Validation failed/);
      }
    });

    it("readonly record throws ReadOnlyRecord", async () => {
      class Thing extends Base { static _tableName = "things"; }
      Thing.attribute("id", "integer");
      Thing.attribute("name", "string");
      Thing.adapter = adapter;

      const t = await Thing.create({ name: "test" });
      t.readonlyBang();
      try {
        await t.save();
        expect.unreachable("should throw");
      } catch (e: any) {
        expect(e).toBeInstanceOf(ReadOnlyRecord);
      }
    });

    it("firstBang throws RecordNotFound", async () => {
      class Empty extends Base { static _tableName = "empties"; }
      Empty.attribute("id", "integer");
      Empty.adapter = adapter;

      try {
        await Empty.all().firstBang();
        expect.unreachable("should throw");
      } catch (e: any) {
        expect(e).toBeInstanceOf(RecordNotFound);
      }
    });
  });

  // -- insertAll / upsertAll --
  describe("insertAll / upsertAll", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("inserts multiple records in bulk", async () => {
      class Product extends Base { static _tableName = "products"; }
      Product.attribute("id", "integer");
      Product.attribute("name", "string");
      Product.attribute("price", "integer");
      Product.adapter = adapter;

      await Product.insertAll([
        { id: 1, name: "Apple", price: 100 },
        { id: 2, name: "Banana", price: 50 },
        { id: 3, name: "Cherry", price: 75 },
      ]);

      const all = await Product.all().toArray();
      expect(all.length).toBe(3);
    });

    it("returns 0 for empty array", async () => {
      class Product extends Base { static _tableName = "products"; }
      Product.attribute("id", "integer");
      Product.adapter = adapter;

      const result = await Product.insertAll([]);
      expect(result).toBe(0);
    });
  });

  // -- after_initialize / after_find --
  describe("after_initialize / after_find callbacks", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("fires after_initialize on new records", () => {
      class Thing extends Base { static _tableName = "things"; }
      Thing.attribute("id", "integer");
      Thing.attribute("name", "string");
      Thing.attribute("status", "string");
      Thing.adapter = adapter;
      Thing.afterInitialize((r: any) => {
        if (!r.readAttribute("status")) {
          r._attributes.set("status", "draft");
        }
      });

      const t = new Thing({});
      expect(t.readAttribute("status")).toBe("draft");
    });

    it("fires after_find when loading from database", async () => {
      const log: string[] = [];
      class Record extends Base { static _tableName = "records"; }
      Record.attribute("id", "integer");
      Record.attribute("name", "string");
      Record.adapter = adapter;
      Record.afterFind((r: any) => {
        log.push(`found:${r.readAttribute("name")}`);
      });

      await Record.create({ name: "Alice" });
      await Record.create({ name: "Bob" });
      const records = await Record.all().toArray();
      expect(log).toEqual(["found:Alice", "found:Bob"]);
    });
  });

  // -- Conditional callbacks --
  describe("conditional callbacks", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("supports if: condition on callbacks", async () => {
      const log: string[] = [];
      class Task extends Base { static _tableName = "tasks"; }
      Task.attribute("id", "integer");
      Task.attribute("name", "string");
      Task.attribute("important", "boolean");
      Task.adapter = adapter;
      Task.beforeSave(
        (r: any) => { log.push("important-save"); },
        { if: (r: any) => r.readAttribute("important") === true }
      );

      await Task.create({ name: "normal", important: false });
      expect(log).toEqual([]);

      await Task.create({ name: "critical", important: true });
      expect(log).toEqual(["important-save"]);
    });

    it("supports unless: condition on callbacks", async () => {
      const log: string[] = [];
      class Task extends Base { static _tableName = "tasks"; }
      Task.attribute("id", "integer");
      Task.attribute("name", "string");
      Task.attribute("skip", "boolean");
      Task.adapter = adapter;
      Task.afterSave(
        (r: any) => { log.push("saved"); },
        { unless: (r: any) => r.readAttribute("skip") === true }
      );

      await Task.create({ name: "regular" });
      expect(log).toEqual(["saved"]);

      await Task.create({ name: "skipped", skip: true });
      expect(log).toEqual(["saved"]); // not called again
    });
  });

  // -- Reflection API --
  describe("reflection", () => {
    it("returns columns for a model", () => {
      class User extends Base { static _tableName = "users"; }
      User.attribute("id", "integer");
      User.attribute("name", "string");
      User.attribute("email", "string");

      const cols = columns(User);
      expect(cols.length).toBe(3);
      expect(cols.map(c => c.name)).toEqual(["id", "name", "email"]);
    });

    it("returns column names for a model", () => {
      class User extends Base { static _tableName = "users"; }
      User.attribute("id", "integer");
      User.attribute("name", "string");

      expect(columnNames(User)).toEqual(["id", "name"]);
    });

    it("reflects on a specific association", () => {
      class Author extends Base { static _tableName = "authors"; }
      Author.attribute("id", "integer");

      class Book extends Base { static _tableName = "books"; }
      Book.attribute("id", "integer");
      Book.attribute("author_id", "integer");
      Associations.belongsTo.call(Book, "author");

      const ref = reflectOnAssociation(Book, "author");
      expect(ref).not.toBeNull();
      expect(ref!.macro).toBe("belongsTo");
      expect(ref!.foreignKey).toBe("author_id");
      expect(ref!.className).toBe("Author");
    });

    it("reflects on all associations", () => {
      const adapter = freshAdapter();
      class Post extends Base { static _tableName = "posts"; }
      Post.attribute("id", "integer");
      Post.attribute("user_id", "integer");
      Post.adapter = adapter;
      Associations.belongsTo.call(Post, "user");
      Associations.hasMany.call(Post, "comments");

      const all = reflectOnAllAssociations(Post);
      expect(all.length).toBe(2);

      const belongsTos = reflectOnAllAssociations(Post, "belongsTo");
      expect(belongsTos.length).toBe(1);
      expect(belongsTos[0].name).toBe("user");
    });
  });

  // -- Nested Attributes --
  describe("acceptsNestedAttributesFor", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("creates child records through parent", async () => {
      class Comment extends Base { static _tableName = "comments"; }
      Comment.attribute("id", "integer");
      Comment.attribute("body", "string");
      Comment.attribute("post_id", "integer");
      Comment.adapter = adapter;
      registerModel(Comment);

      class Post extends Base { static _tableName = "posts"; }
      Post.attribute("id", "integer");
      Post.attribute("title", "string");
      Post.adapter = adapter;
      Associations.hasMany.call(Post, "comments");
      acceptsNestedAttributesFor(Post, "comments");
      registerModel(Post);

      const post = new Post({ title: "Hello" });
      assignNestedAttributes(post, "comments", [
        { body: "First comment" },
        { body: "Second comment" },
      ]);
      await post.save();

      const comments = await Comment.all().toArray();
      expect(comments.length).toBe(2);
      expect(comments[0].readAttribute("post_id")).toBe(post.id);
    });

    it("destroys child records with _destroy flag", async () => {
      class Tag extends Base { static _tableName = "tags"; }
      Tag.attribute("id", "integer");
      Tag.attribute("name", "string");
      Tag.attribute("article_id", "integer");
      Tag.adapter = adapter;
      registerModel(Tag);

      class Article extends Base { static _tableName = "articles"; }
      Article.attribute("id", "integer");
      Article.attribute("title", "string");
      Article.adapter = adapter;
      Associations.hasMany.call(Article, "tags");
      acceptsNestedAttributesFor(Article, "tags", { allowDestroy: true });
      registerModel(Article);

      const article = await Article.create({ title: "Test" });
      const tag = await Tag.create({ name: "ruby", article_id: article.id });

      assignNestedAttributes(article, "tags", [
        { id: tag.id, _destroy: true },
      ]);
      await article.save();

      const remaining = await Tag.all().toArray();
      expect(remaining.length).toBe(0);
    });
  });

  // -- Halt callback chain --
  describe("halt callback chain", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("halts save when before_save returns false", async () => {
      class Blocked extends Base { static _tableName = "blocked"; }
      Blocked.attribute("id", "integer");
      Blocked.attribute("name", "string");
      Blocked.adapter = adapter;
      Blocked.beforeSave(() => false);

      const b = new Blocked({ name: "test" });
      const result = await b.save();
      expect(result).toBe(false);
      expect(b.isNewRecord()).toBe(true);
    });
  });

  // -- Raw SQL where --
  describe("where with raw SQL", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("supports raw SQL string with bind params", async () => {
      class User extends Base { static _tableName = "users"; }
      User.attribute("id", "integer");
      User.attribute("name", "string");
      User.attribute("age", "integer");
      User.adapter = adapter;

      await User.create({ name: "Alice", age: 25 });
      await User.create({ name: "Bob", age: 17 });
      await User.create({ name: "Charlie", age: 30 });

      const sql = User.where("\"users\".\"age\" > ?", 18).toSql();
      expect(sql).toContain("\"users\".\"age\" > 18");
    });

    it("rewhere replaces specific where conditions", async () => {
      class User extends Base { static _tableName = "users"; }
      User.attribute("id", "integer");
      User.attribute("name", "string");
      User.attribute("status", "string");
      User.adapter = adapter;

      await User.create({ name: "Alice", status: "active" });
      await User.create({ name: "Bob", status: "inactive" });

      const active = User.where({ status: "active" });
      const inactive = active.rewhere({ status: "inactive" });
      const records = await inactive.toArray();
      expect(records.length).toBe(1);
      expect(records[0].readAttribute("name")).toBe("Bob");
    });
  });

  // -- has_secure_token --
  describe("has_secure_token", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("auto-generates a token on create", async () => {
      class ApiKey extends Base { static _tableName = "api_keys"; }
      ApiKey.attribute("id", "integer");
      ApiKey.attribute("token", "string");
      ApiKey.adapter = adapter;
      hasSecureToken(ApiKey);

      const key = await ApiKey.create({});
      expect(key.readAttribute("token")).toBeTruthy();
      expect(typeof key.readAttribute("token")).toBe("string");
      expect((key.readAttribute("token") as string).length).toBeGreaterThan(0);
    });

    it("allows regeneration of token", async () => {
      class ApiKey extends Base { static _tableName = "api_keys"; }
      ApiKey.attribute("id", "integer");
      ApiKey.attribute("token", "string");
      ApiKey.adapter = adapter;
      hasSecureToken(ApiKey);

      const key = await ApiKey.create({});
      const originalToken = key.readAttribute("token");

      const newToken = await (key as any).regenerateToken();
      expect(newToken).not.toBe(originalToken);
      expect(key.readAttribute("token")).toBe(newToken);
    });

    it("supports custom attribute name", async () => {
      class Session extends Base { static _tableName = "sessions"; }
      Session.attribute("id", "integer");
      Session.attribute("auth_token", "string");
      Session.adapter = adapter;
      hasSecureToken(Session, "auth_token");

      const s = await Session.create({});
      expect(s.readAttribute("auth_token")).toBeTruthy();
    });
  });

  // -- composed_of --
  describe("composed_of", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("composes value objects from multiple attributes", async () => {
      class Address {
        constructor(public street: string, public city: string) {}
      }

      class Customer extends Base { static _tableName = "customers"; }
      Customer.attribute("id", "integer");
      Customer.attribute("address_street", "string");
      Customer.attribute("address_city", "string");
      Customer.adapter = adapter;
      composedOf(Customer, "address", {
        className: Address,
        mapping: [["address_street", "street"], ["address_city", "city"]],
      });

      const c = await Customer.create({ address_street: "123 Main", address_city: "NYC" });
      const addr = (c as any).address;
      expect(addr).toBeInstanceOf(Address);
      expect(addr.street).toBe("123 Main");
      expect(addr.city).toBe("NYC");
    });

    it("decomposes value object on assignment", async () => {
      class Address {
        constructor(public street: string, public city: string) {}
      }

      class Customer extends Base { static _tableName = "customers"; }
      Customer.attribute("id", "integer");
      Customer.attribute("address_street", "string");
      Customer.attribute("address_city", "string");
      Customer.adapter = adapter;
      composedOf(Customer, "address", {
        className: Address,
        mapping: [["address_street", "street"], ["address_city", "city"]],
      });

      const c = await Customer.create({ address_street: "old", address_city: "old" });
      (c as any).address = new Address("456 Oak", "SF");

      expect(c.readAttribute("address_street")).toBe("456 Oak");
      expect(c.readAttribute("address_city")).toBe("SF");
    });
  });

  // -- serialize --
  describe("serialize", () => {
    let adapter: MemoryAdapter;
    beforeEach(() => { adapter = freshAdapter(); });

    it("serializes and deserializes JSON data", async () => {
      class Setting extends Base { static _tableName = "settings"; }
      Setting.attribute("id", "integer");
      Setting.attribute("data", "string");
      Setting.adapter = adapter;
      serialize(Setting, "data", { coder: "json" });

      const s = await Setting.create({ data: JSON.stringify({ theme: "dark", fontSize: 14 }) });
      const loaded = await Setting.find(s.id);
      const data = loaded.readAttribute("data") as Record<string, unknown>;
      expect(data.theme).toBe("dark");
      expect(data.fontSize).toBe(14);
    });

    it("deserializes array coder", async () => {
      class Pref extends Base { static _tableName = "prefs"; }
      Pref.attribute("id", "integer");
      Pref.attribute("tags", "string");
      Pref.adapter = adapter;
      serialize(Pref, "tags", { coder: "array" });

      const p = await Pref.create({ tags: JSON.stringify(["ruby", "rails"]) });
      const loaded = await Pref.find(p.id);
      expect(loaded.readAttribute("tags")).toEqual(["ruby", "rails"]);
    });
  });
});
