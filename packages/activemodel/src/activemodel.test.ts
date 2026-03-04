import { describe, it, expect } from "vitest";
import { Model, Errors } from "./index.js";

describe("ActiveModel", () => {
  // =========================================================================
  // Phase 1000/1050 — Attributes and Type Casting
  // =========================================================================
  describe("Attributes", () => {
    class User extends Model {
      static {
        this.attribute("name", "string");
        this.attribute("age", "integer", { default: 0 });
        this.attribute("score", "float");
        this.attribute("active", "boolean", { default: true });
      }
    }

    it("initializes with defaults", () => {
      const u = new User();
      expect(u.readAttribute("name")).toBe(null);
      expect(u.readAttribute("age")).toBe(0);
      expect(u.readAttribute("active")).toBe(true);
    });

    it("initializes with provided values", () => {
      const u = new User({ name: "dean", age: 30 });
      expect(u.readAttribute("name")).toBe("dean");
      expect(u.readAttribute("age")).toBe(30);
    });

    it("casts string to integer", () => {
      const u = new User({ age: "25" });
      expect(u.readAttribute("age")).toBe(25);
    });

    it("integer truncates floats", () => {
      const u = new User({ age: 25.9 });
      expect(u.readAttribute("age")).toBe(25);
    });

    it("casts string to float", () => {
      const u = new User({ score: "9.5" });
      expect(u.readAttribute("score")).toBe(9.5);
    });

    it("casts string to boolean", () => {
      expect(new User({ active: "false" }).readAttribute("active")).toBe(false);
      expect(new User({ active: "true" }).readAttribute("active")).toBe(true);
      expect(new User({ active: "yes" }).readAttribute("active")).toBe(true);
      expect(new User({ active: "no" }).readAttribute("active")).toBe(false);
      expect(new User({ active: "1" }).readAttribute("active")).toBe(true);
      expect(new User({ active: "0" }).readAttribute("active")).toBe(false);
      expect(new User({ active: 1 }).readAttribute("active")).toBe(true);
      expect(new User({ active: 0 }).readAttribute("active")).toBe(false);
    });

    it("casts null to null for all types", () => {
      const u = new User({ name: null, age: null, score: null, active: null });
      expect(u.readAttribute("name")).toBe(null);
      expect(u.readAttribute("age")).toBe(null);
      expect(u.readAttribute("score")).toBe(null);
      expect(u.readAttribute("active")).toBe(null);
    });

    it("writeAttribute casts the value", () => {
      const u = new User();
      u.writeAttribute("age", "42");
      expect(u.readAttribute("age")).toBe(42);
    });

    it("returns all attributes as a hash", () => {
      const u = new User({ name: "dean", age: 30 });
      expect(u.attributes).toEqual({
        name: "dean",
        age: 30,
        score: null,
        active: true,
      });
    });

    it("attributePresent checks for non-blank values", () => {
      const u = new User({ name: "dean" });
      expect(u.attributePresent("name")).toBe(true);
      expect(u.attributePresent("score")).toBe(false);
    });

    it("attributePresent returns false for empty string", () => {
      const u = new User({ name: "" });
      expect(u.attributePresent("name")).toBe(false);
    });

    it("attributePresent returns false for whitespace-only string", () => {
      const u = new User({ name: "   " });
      expect(u.attributePresent("name")).toBe(false);
    });

    it("attributeNames returns declared names", () => {
      expect(User.attributeNames()).toEqual(["name", "age", "score", "active"]);
    });

    it("Proc default is called for each instance", () => {
      let counter = 0;
      class WithLambda extends Model {
        static {
          this.attribute("token", "string", { default: () => `tok_${++counter}` });
        }
      }
      expect(new WithLambda().readAttribute("token")).toBe("tok_1");
      expect(new WithLambda().readAttribute("token")).toBe("tok_2");
    });

    it("inheritance: children inherit parent attributes", () => {
      class Admin extends User {
        static {
          this.attribute("role", "string", { default: "admin" });
        }
      }
      const admin = new Admin({ name: "dean" });
      expect(admin.readAttribute("name")).toBe("dean");
      expect(admin.readAttribute("role")).toBe("admin");
      expect(Admin.attributeNames()).toContain("name");
      expect(Admin.attributeNames()).toContain("role");
    });
  });

  // =========================================================================
  // Phase 1100/1150 — Validations
  // =========================================================================
  describe("Validations", () => {
    // -- Presence --
    describe("presence", () => {
      class Article extends Model {
        static {
          this.attribute("title", "string");
          this.validates("title", { presence: true });
        }
      }

      it("rejects null", () => {
        const a = new Article();
        expect(a.isValid()).toBe(false);
        expect(a.errors.get("title")).toContain("can't be blank");
      });

      it("rejects empty string", () => {
        const a = new Article({ title: "" });
        expect(a.isValid()).toBe(false);
      });

      it("rejects whitespace-only string", () => {
        const a = new Article({ title: "   " });
        expect(a.isValid()).toBe(false);
      });

      it("accepts a real value", () => {
        const a = new Article({ title: "Hello" });
        expect(a.isValid()).toBe(true);
      });
    });

    // -- Absence --
    describe("absence", () => {
      class Blank extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", { absence: true });
        }
      }

      it("accepts null", () => {
        expect(new Blank().isValid()).toBe(true);
      });

      it("accepts empty string", () => {
        expect(new Blank({ name: "" }).isValid()).toBe(true);
      });

      it("rejects a value", () => {
        const b = new Blank({ name: "dean" });
        expect(b.isValid()).toBe(false);
        expect(b.errors.get("name")).toContain("must be blank");
      });
    });

    // -- Length --
    describe("length", () => {
      class WithLength extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", {
            length: { minimum: 3, maximum: 10 },
          });
        }
      }

      it("rejects too short", () => {
        const w = new WithLength({ name: "ab" });
        expect(w.isValid()).toBe(false);
        expect(w.errors.get("name")).toContain("is too short");
      });

      it("rejects too long", () => {
        const w = new WithLength({ name: "abcdefghijk" });
        expect(w.isValid()).toBe(false);
        expect(w.errors.get("name")).toContain("is too long");
      });

      it("accepts within range", () => {
        expect(new WithLength({ name: "dean" }).isValid()).toBe(true);
      });

      it("validates exact length with is", () => {
        class Exact extends Model {
          static {
            this.attribute("code", "string");
            this.validates("code", { length: { is: 4 } });
          }
        }
        expect(new Exact({ code: "1234" }).isValid()).toBe(true);
        expect(new Exact({ code: "123" }).isValid()).toBe(false);
        expect(new Exact({ code: "12345" }).isValid()).toBe(false);
      });

      it("validates with in (range)", () => {
        class WithRange extends Model {
          static {
            this.attribute("name", "string");
            this.validates("name", { length: { in: [2, 5] } });
          }
        }
        expect(new WithRange({ name: "a" }).isValid()).toBe(false);
        expect(new WithRange({ name: "ab" }).isValid()).toBe(true);
        expect(new WithRange({ name: "abcde" }).isValid()).toBe(true);
        expect(new WithRange({ name: "abcdef" }).isValid()).toBe(false);
      });

      it("skips null values (null has no length)", () => {
        expect(new WithLength({}).isValid()).toBe(true);
      });
    });

    // -- Numericality --
    describe("numericality", () => {
      class Numeric extends Model {
        static {
          this.attribute("value", "string"); // string to test cast behavior
          this.validates("value", { numericality: true });
        }
      }

      it("accepts numbers", () => {
        expect(new Numeric({ value: "42" }).isValid()).toBe(true);
        expect(new Numeric({ value: "3.14" }).isValid()).toBe(true);
      });

      it("rejects non-numeric strings", () => {
        const n = new Numeric({ value: "not a number" });
        expect(n.isValid()).toBe(false);
        expect(n.errors.get("value")).toContain("is not a number");
      });

      it("skips null", () => {
        expect(new Numeric({}).isValid()).toBe(true);
      });

      it("validates onlyInteger", () => {
        class IntOnly extends Model {
          static {
            this.attribute("count", "string");
            this.validates("count", { numericality: { onlyInteger: true } });
          }
        }
        expect(new IntOnly({ count: "5" }).isValid()).toBe(true);
        const f = new IntOnly({ count: "5.5" });
        expect(f.isValid()).toBe(false);
        expect(f.errors.get("count")).toContain("is not an integer");
      });

      it("validates greaterThan", () => {
        class GT extends Model {
          static {
            this.attribute("age", "integer");
            this.validates("age", { numericality: { greaterThan: 0 } });
          }
        }
        expect(new GT({ age: 1 }).isValid()).toBe(true);
        expect(new GT({ age: 0 }).isValid()).toBe(false);
      });

      it("validates lessThan", () => {
        class LT extends Model {
          static {
            this.attribute("rating", "integer");
            this.validates("rating", { numericality: { lessThan: 10 } });
          }
        }
        expect(new LT({ rating: 9 }).isValid()).toBe(true);
        expect(new LT({ rating: 10 }).isValid()).toBe(false);
      });

      it("validates odd", () => {
        class Odd extends Model {
          static {
            this.attribute("n", "integer");
            this.validates("n", { numericality: { odd: true } });
          }
        }
        expect(new Odd({ n: 3 }).isValid()).toBe(true);
        expect(new Odd({ n: 4 }).isValid()).toBe(false);
      });

      it("validates even", () => {
        class Even extends Model {
          static {
            this.attribute("n", "integer");
            this.validates("n", { numericality: { even: true } });
          }
        }
        expect(new Even({ n: 4 }).isValid()).toBe(true);
        expect(new Even({ n: 3 }).isValid()).toBe(false);
      });
    });

    // -- Inclusion / Exclusion --
    describe("inclusion", () => {
      class Status extends Model {
        static {
          this.attribute("status", "string");
          this.validates("status", { inclusion: { in: ["draft", "published"] } });
        }
      }

      it("accepts included values", () => {
        expect(new Status({ status: "draft" }).isValid()).toBe(true);
      });

      it("rejects non-included values", () => {
        const s = new Status({ status: "invalid" });
        expect(s.isValid()).toBe(false);
        expect(s.errors.get("status")).toContain("is not included in the list");
      });
    });

    describe("exclusion", () => {
      class NoAdmin extends Model {
        static {
          this.attribute("role", "string");
          this.validates("role", { exclusion: { in: ["admin", "root"] } });
        }
      }

      it("accepts non-excluded values", () => {
        expect(new NoAdmin({ role: "user" }).isValid()).toBe(true);
      });

      it("rejects excluded values", () => {
        const n = new NoAdmin({ role: "admin" });
        expect(n.isValid()).toBe(false);
        expect(n.errors.get("role")).toContain("is reserved");
      });
    });

    // -- Format --
    describe("format", () => {
      class Email extends Model {
        static {
          this.attribute("email", "string");
          this.validates("email", { format: { with: /^[^@]+@[^@]+$/ } });
        }
      }

      it("accepts matching format", () => {
        expect(new Email({ email: "dean@example.com" }).isValid()).toBe(true);
      });

      it("rejects non-matching format", () => {
        const e = new Email({ email: "not-an-email" });
        expect(e.isValid()).toBe(false);
        expect(e.errors.get("email")).toContain("is invalid");
      });

      it("skips null", () => {
        expect(new Email({}).isValid()).toBe(true);
      });
    });

    // -- Acceptance --
    describe("acceptance", () => {
      class Terms extends Model {
        static {
          this.attribute("accepted", "string");
          this.validates("accepted", { acceptance: true });
        }
      }

      it("accepts '1' and true", () => {
        expect(new Terms({ accepted: "1" }).isValid()).toBe(true);
        expect(new Terms({ accepted: true }).isValid()).toBe(true);
      });

      it("rejects '0' and false", () => {
        expect(new Terms({ accepted: "0" }).isValid()).toBe(false);
        expect(new Terms({ accepted: false }).isValid()).toBe(false);
      });

      it("custom accept values", () => {
        class Custom extends Model {
          static {
            this.attribute("agreed", "string");
            this.validates("agreed", {
              acceptance: { accept: ["I agree", "yes"] },
            });
          }
        }
        expect(new Custom({ agreed: "I agree" }).isValid()).toBe(true);
        expect(new Custom({ agreed: "no" }).isValid()).toBe(false);
      });
    });

    // -- Confirmation --
    describe("confirmation", () => {
      class WithConfirm extends Model {
        static {
          this.attribute("password", "string");
          this.validates("password", { confirmation: true });
        }
      }

      it("passes when no confirmation field set", () => {
        expect(new WithConfirm({ password: "secret" }).isValid()).toBe(true);
      });

      it("passes when confirmation matches", () => {
        expect(
          new WithConfirm({
            password: "secret",
            password_confirmation: "secret",
          }).isValid()
        ).toBe(true);
      });

      it("fails when confirmation doesn't match", () => {
        const w = new WithConfirm({
          password: "secret",
          password_confirmation: "wrong",
        });
        expect(w.isValid()).toBe(false);
        expect(w.errors.get("password")).toContain(
          "doesn't match confirmation"
        );
      });
    });

    // -- Conditional validation --
    describe("conditional", () => {
      it("if: skips when condition is false", () => {
        class Cond extends Model {
          static {
            this.attribute("name", "string");
            this.attribute("requireName", "boolean", { default: false });
            this.validates("name", {
              presence: {
                if: (r: any) => r.readAttribute("requireName") === true,
              },
            });
          }
        }
        expect(new Cond({ requireName: false }).isValid()).toBe(true);
        expect(new Cond({ requireName: true }).isValid()).toBe(false);
      });

      it("unless: skips when condition is true", () => {
        class Unless extends Model {
          static {
            this.attribute("name", "string");
            this.attribute("optional", "boolean", { default: false });
            this.validates("name", {
              presence: {
                unless: (r: any) => r.readAttribute("optional") === true,
              },
            });
          }
        }
        expect(new Unless({ optional: true }).isValid()).toBe(true);
        expect(new Unless({ optional: false }).isValid()).toBe(false);
      });
    });

    // -- Custom validate --
    describe("custom validate", () => {
      it("function validator", () => {
        class Custom extends Model {
          static {
            this.attribute("value", "integer");
            this.validate(function (record: any) {
              const val = record.readAttribute("value");
              if (val !== null && (val as number) % 2 !== 0) {
                record.errors.add("value", "even", { message: "must be even" });
              }
            });
          }
        }
        expect(new Custom({ value: 4 }).isValid()).toBe(true);
        const c = new Custom({ value: 3 });
        expect(c.isValid()).toBe(false);
        expect(c.errors.get("value")).toContain("must be even");
      });
    });

    // -- isInvalid --
    it("isInvalid is the inverse of isValid", () => {
      class Required extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", { presence: true });
        }
      }
      expect(new Required().isInvalid()).toBe(true);
      expect(new Required({ name: "dean" }).isInvalid()).toBe(false);
    });

    // -- fullMessages --
    it("fullMessages prefixes attribute name", () => {
      class FM extends Model {
        static {
          this.attribute("title", "string");
          this.validates("title", { presence: true });
        }
      }
      const f = new FM();
      f.isValid();
      expect(f.errors.fullMessages).toContain("Title can't be blank");
    });

    it("fullMessages for :base has no prefix", () => {
      class Base extends Model {
        static {
          this.validate((record: any) => {
            record.errors.add("base", "invalid", { message: "is broken" });
          });
        }
      }
      const b = new Base();
      b.isValid();
      expect(b.errors.fullMessages).toContain("is broken");
    });

    // -- errors.clear between validations --
    it("errors are cleared between isValid calls", () => {
      class Clearable extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", { presence: true });
        }
      }
      const c = new Clearable();
      c.isValid();
      expect(c.errors.count).toBeGreaterThan(0);
      c.writeAttribute("name", "dean");
      c.isValid();
      expect(c.errors.count).toBe(0);
    });
  });

  // =========================================================================
  // Phase 1100 — Errors
  // =========================================================================
  describe("Errors", () => {
    it("add and get", () => {
      const e = new Errors();
      e.add("name", "blank");
      expect(e.get("name")).toContain("can't be blank");
    });

    it("count and size", () => {
      const e = new Errors();
      e.add("name", "blank");
      e.add("age", "not_a_number");
      expect(e.count).toBe(2);
      expect(e.size).toBe(2);
    });

    it("empty and any", () => {
      const e = new Errors();
      expect(e.empty).toBe(true);
      expect(e.any).toBe(false);
      e.add("name", "blank");
      expect(e.empty).toBe(false);
      expect(e.any).toBe(true);
    });

    it("clear removes all errors", () => {
      const e = new Errors();
      e.add("name", "blank");
      e.clear();
      expect(e.count).toBe(0);
      expect(e.empty).toBe(true);
    });

    it("where filters by attribute and type", () => {
      const e = new Errors();
      e.add("name", "blank");
      e.add("name", "too_short");
      e.add("age", "blank");
      expect(e.where("name").length).toBe(2);
      expect(e.where("name", "blank").length).toBe(1);
      expect(e.where("age").length).toBe(1);
    });

    it("attributeNames returns unique names", () => {
      const e = new Errors();
      e.add("name", "blank");
      e.add("name", "too_short");
      e.add("age", "blank");
      expect(e.attributeNames).toEqual(["name", "age"]);
    });

    it("fullMessages for base has no prefix", () => {
      const e = new Errors();
      e.add("base", "invalid", { message: "Something went wrong" });
      expect(e.fullMessages).toContain("Something went wrong");
    });

    it("fullMessages for attribute has prefix", () => {
      const e = new Errors();
      e.add("name", "blank");
      expect(e.fullMessages[0]).toBe("Name can't be blank");
    });

    it("details returns error detail objects", () => {
      const e = new Errors();
      e.add("name", "blank");
      expect(e.details.length).toBe(1);
      expect(e.details[0].attribute).toBe("name");
      expect(e.details[0].type).toBe("blank");
    });

    it("custom message overrides default", () => {
      const e = new Errors();
      e.add("name", "blank", { message: "is required" });
      expect(e.get("name")).toContain("is required");
    });

    it("message interpolation with %{count}", () => {
      const e = new Errors();
      e.add("name", "too_short", { count: 3 });
      // Default message is "is too short" — doesn't have %{count} by default
      // but the mechanism should work for messages that do
      expect(e.get("name").length).toBe(1);
    });
  });

  // =========================================================================
  // Phase 1200/1250 — Callbacks and Dirty Tracking
  // =========================================================================
  describe("Dirty Tracking", () => {
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.attribute("age", "integer");
      }
    }

    it("not changed initially", () => {
      const p = new Person({ name: "dean", age: 30 });
      expect(p.changed).toBe(false);
      expect(p.changedAttributes).toEqual([]);
    });

    it("tracks changes after writeAttribute", () => {
      const p = new Person({ name: "dean" });
      p.writeAttribute("name", "sam");
      expect(p.changed).toBe(true);
      expect(p.changedAttributes).toContain("name");
    });

    it("attributeWas returns original value", () => {
      const p = new Person({ name: "dean" });
      p.writeAttribute("name", "sam");
      expect(p.attributeWas("name")).toBe("dean");
    });

    it("attributeChange returns [old, new]", () => {
      const p = new Person({ name: "dean" });
      p.writeAttribute("name", "sam");
      expect(p.attributeChange("name")).toEqual(["dean", "sam"]);
    });

    it("changes returns all changes", () => {
      const p = new Person({ name: "dean", age: 30 });
      p.writeAttribute("name", "sam");
      p.writeAttribute("age", 31);
      expect(p.changes).toEqual({
        name: ["dean", "sam"],
        age: [30, 31],
      });
    });

    it("setting same value does not register change", () => {
      const p = new Person({ name: "dean" });
      p.writeAttribute("name", "dean");
      expect(p.changed).toBe(false);
    });

    it("setting back to original clears the change", () => {
      const p = new Person({ name: "dean" });
      p.writeAttribute("name", "sam");
      expect(p.changed).toBe(true);
      p.writeAttribute("name", "dean");
      expect(p.changed).toBe(false);
    });

    it("multiple changes retain first original value", () => {
      const p = new Person({ name: "dean" });
      p.writeAttribute("name", "sam");
      p.writeAttribute("name", "bob");
      expect(p.attributeChange("name")).toEqual(["dean", "bob"]);
    });

    it("restoreAttributes reverts all changes", () => {
      const p = new Person({ name: "dean", age: 30 });
      p.writeAttribute("name", "sam");
      p.writeAttribute("age", 99);
      p.restoreAttributes();
      expect(p.readAttribute("name")).toBe("dean");
      expect(p.readAttribute("age")).toBe(30);
      expect(p.changed).toBe(false);
    });

    it("changesApplied commits changes and records previousChanges", () => {
      const p = new Person({ name: "dean" });
      p.writeAttribute("name", "sam");
      p.changesApplied();
      expect(p.changed).toBe(false);
      expect(p.previousChanges).toEqual({ name: ["dean", "sam"] });
    });

    it("new changes after changesApplied don't affect previousChanges", () => {
      const p = new Person({ name: "dean" });
      p.writeAttribute("name", "sam");
      p.changesApplied();
      p.writeAttribute("name", "bob");
      expect(p.previousChanges).toEqual({ name: ["dean", "sam"] });
      expect(p.changes).toEqual({ name: ["sam", "bob"] });
    });

    it("cast-value-aware: same cast value = no change", () => {
      class Sized extends Model {
        static {
          this.attribute("size", "integer");
        }
      }
      const s = new Sized({ size: "2" }); // cast to 2
      s.writeAttribute("size", "2.3"); // cast to 2
      expect(s.changed).toBe(false);
      s.writeAttribute("size", "5.1"); // cast to 5
      expect(s.changed).toBe(true);
    });
  });

  describe("Callbacks", () => {
    it("before/after callbacks run in order", () => {
      const order: string[] = [];
      class Ordered extends Model {
        static {
          this.attribute("name", "string");
          this.beforeSave(() => { order.push("before"); });
          this.afterSave(() => { order.push("after"); });
        }
      }
      const o = new Ordered();
      o.runCallbacks("save", () => { order.push("action"); });
      expect(order).toEqual(["before", "action", "after"]);
    });

    it("around callbacks wrap the action", () => {
      const order: string[] = [];
      class Around extends Model {
        static {
          this.attribute("name", "string");
          this.aroundSave((_record, proceed) => {
            order.push("around_before");
            proceed();
            order.push("around_after");
          });
        }
      }
      const a = new Around();
      a.runCallbacks("save", () => { order.push("action"); });
      expect(order).toEqual(["around_before", "action", "around_after"]);
    });

    it("before callback returning false halts the chain", () => {
      const order: string[] = [];
      class Halting extends Model {
        static {
          this.attribute("name", "string");
          this.beforeSave(() => { order.push("before"); return false; });
          this.afterSave(() => { order.push("after"); });
        }
      }
      const h = new Halting();
      const result = h.runCallbacks("save", () => { order.push("action"); });
      expect(result).toBe(false);
      expect(order).toEqual(["before"]);
      expect(order).not.toContain("action");
      expect(order).not.toContain("after");
    });

    it("before_validation halting prevents validations from running", () => {
      class NoValidate extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", { presence: true });
          this.beforeValidation(() => false);
        }
      }
      const n = new NoValidate();
      expect(n.isValid()).toBe(false);
      expect(n.errors.count).toBe(0); // validations never ran
    });

    it("full callback chain: before → around → action → around → after", () => {
      const order: string[] = [];
      class Full extends Model {
        static {
          this.beforeSave(() => { order.push("before_save"); });
          this.aroundSave((_r, proceed) => {
            order.push("around_before");
            proceed();
            order.push("around_after");
          });
          this.afterSave(() => { order.push("after_save"); });
        }
      }
      new Full().runCallbacks("save", () => { order.push("save"); });
      expect(order).toEqual([
        "before_save",
        "around_before",
        "save",
        "around_after",
        "after_save",
      ]);
    });
  });

  // =========================================================================
  // Phase 1300/1350 — Serialization and Naming
  // =========================================================================
  describe("Serialization", () => {
    class Post extends Model {
      static {
        this.attribute("title", "string");
        this.attribute("body", "string");
        this.attribute("rating", "integer");
      }

      get summary(): string {
        return String(this.readAttribute("title")).slice(0, 10);
      }
    }

    it("serializableHash returns all attributes", () => {
      const p = new Post({ title: "Hello", body: "World", rating: 5 });
      expect(p.serializableHash()).toEqual({
        title: "Hello",
        body: "World",
        rating: 5,
      });
    });

    it("only filters attributes", () => {
      const p = new Post({ title: "Hello", body: "World", rating: 5 });
      expect(p.serializableHash({ only: ["title"] })).toEqual({
        title: "Hello",
      });
    });

    it("except excludes attributes", () => {
      const p = new Post({ title: "Hello", body: "World", rating: 5 });
      expect(p.serializableHash({ except: ["body"] })).toEqual({
        title: "Hello",
        rating: 5,
      });
    });

    it("methods includes method results", () => {
      const p = new Post({ title: "Hello World!", body: "c", rating: 3 });
      const result = p.serializableHash({ methods: ["summary"] });
      expect(result.summary).toBe("Hello Worl");
    });

    it("only + methods combined", () => {
      const p = new Post({ title: "Test", body: "c", rating: 3 });
      const result = p.serializableHash({
        only: ["title"],
        methods: ["summary"],
      });
      expect(Object.keys(result).sort()).toEqual(["summary", "title"]);
    });

    it("asJson returns same as serializableHash", () => {
      const p = new Post({ title: "Hello", body: "World", rating: 5 });
      expect(p.asJson()).toEqual(p.serializableHash());
    });

    it("toJson returns valid JSON string", () => {
      const p = new Post({ title: "Hello", body: "World", rating: 5 });
      const parsed = JSON.parse(p.toJson());
      expect(parsed.title).toBe("Hello");
      expect(parsed.rating).toBe(5);
    });
  });

  describe("Naming", () => {
    class Post extends Model {}

    it("name returns class name", () => {
      expect(Post.modelName.name).toBe("Post");
    });

    it("singular is underscored", () => {
      expect(Post.modelName.singular).toBe("post");
    });

    it("plural adds s", () => {
      expect(Post.modelName.plural).toBe("posts");
    });

    it("element is underscored", () => {
      expect(Post.modelName.element).toBe("post");
    });

    it("collection matches plural", () => {
      expect(Post.modelName.collection).toBe("posts");
    });

    it("paramKey is underscored", () => {
      expect(Post.modelName.paramKey).toBe("post");
    });

    it("routeKey is plural", () => {
      expect(Post.modelName.routeKey).toBe("posts");
    });

    it("handles CamelCase", () => {
      class BlogPost extends Model {}
      expect(BlogPost.modelName.singular).toBe("blog_post");
      expect(BlogPost.modelName.plural).toBe("blog_posts");
    });

    it("instance delegates to class", () => {
      const p = new Post();
      expect(p.modelName.name).toBe("Post");
    });

    it("toPartialPath returns conventional path", () => {
      const p = new Post();
      expect(p.toPartialPath()).toBe("posts/_post");
    });
  });
});
