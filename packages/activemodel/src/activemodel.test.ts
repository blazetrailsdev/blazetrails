import { describe, it, expect } from "vitest";
import { Model, Errors, Types } from "./index.js";

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

    it("i18nKey is underscored", () => {
      class BlogPost extends Model {}
      expect(BlogPost.modelName.i18nKey).toBe("blog_post");
    });
  });

  // =========================================================================
  // Types — Date, DateTime, Decimal
  // =========================================================================
  describe("Types", () => {
    describe("DateType", () => {
      const type = new Types.DateType();

      it("has name 'date'", () => {
        expect(type.name).toBe("date");
      });

      it("casts Date to Date", () => {
        const d = new Date("2024-01-15");
        expect(type.cast(d)).toBe(d);
      });

      it("casts string to Date", () => {
        const result = type.cast("2024-01-15");
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2024);
      });

      it("casts null to null", () => {
        expect(type.cast(null)).toBe(null);
      });

      it("casts undefined to null", () => {
        expect(type.cast(undefined)).toBe(null);
      });

      it("casts invalid string to null", () => {
        expect(type.cast("not-a-date")).toBe(null);
      });

      it("deserialize delegates to cast", () => {
        const result = type.deserialize("2024-01-15");
        expect(result).toBeInstanceOf(Date);
      });

      it("serialize delegates to cast", () => {
        const result = type.serialize("2024-01-15");
        expect(result).toBeInstanceOf(Date);
      });
    });

    describe("DateTimeType", () => {
      const type = new Types.DateTimeType();

      it("has name 'datetime'", () => {
        expect(type.name).toBe("datetime");
      });

      it("casts ISO string to Date", () => {
        const result = type.cast("2024-01-15T10:30:00Z");
        expect(result).toBeInstanceOf(Date);
        expect(result!.getUTCHours()).toBe(10);
      });

      it("casts null to null", () => {
        expect(type.cast(null)).toBe(null);
      });

      it("casts Date to Date", () => {
        const d = new Date();
        expect(type.cast(d)).toBe(d);
      });
    });

    describe("DecimalType", () => {
      const type = new Types.DecimalType();

      it("has name 'decimal'", () => {
        expect(type.name).toBe("decimal");
      });

      it("casts number to string", () => {
        expect(type.cast(42.5)).toBe("42.5");
      });

      it("casts string number to string", () => {
        expect(type.cast("3.14")).toBe("3.14");
      });

      it("casts integer to string", () => {
        expect(type.cast(100)).toBe("100");
      });

      it("casts null to null", () => {
        expect(type.cast(null)).toBe(null);
      });

      it("casts NaN string to null", () => {
        expect(type.cast("not-a-number")).toBe(null);
      });
    });

    describe("TypeRegistry", () => {
      it("looks up built-in types", () => {
        const str = Types.typeRegistry.lookup("string");
        expect(str).toBeInstanceOf(Types.StringType);
      });

      it("looks up integer type", () => {
        const int = Types.typeRegistry.lookup("integer");
        expect(int).toBeInstanceOf(Types.IntegerType);
      });

      it("looks up all built-in types", () => {
        expect(Types.typeRegistry.lookup("float")).toBeInstanceOf(Types.FloatType);
        expect(Types.typeRegistry.lookup("boolean")).toBeInstanceOf(Types.BooleanType);
        expect(Types.typeRegistry.lookup("date")).toBeInstanceOf(Types.DateType);
        expect(Types.typeRegistry.lookup("datetime")).toBeInstanceOf(Types.DateTimeType);
        expect(Types.typeRegistry.lookup("decimal")).toBeInstanceOf(Types.DecimalType);
      });

      it("throws on unknown type", () => {
        expect(() => Types.typeRegistry.lookup("imaginary")).toThrow("Unknown type: imaginary");
      });

      it("registers custom type", () => {
        Types.typeRegistry.register("custom", () => new Types.StringType());
        const t = Types.typeRegistry.lookup("custom");
        expect(t).toBeInstanceOf(Types.StringType);
      });
    });
  });

  // =========================================================================
  // Errors.on() alias
  // =========================================================================
  describe("Errors.on()", () => {
    it("on() is an alias for get()", () => {
      const e = new Errors();
      e.add("name", "blank");
      expect(e.on("name")).toEqual(e.get("name"));
      expect(e.on("name")).toContain("can't be blank");
    });

    it("on() returns empty array for unknown attribute", () => {
      const e = new Errors();
      expect(e.on("nonexistent")).toEqual([]);
    });
  });

  // =========================================================================
  // Validators — untested options
  // =========================================================================
  describe("Validators (extended)", () => {
    describe("format with 'without' option", () => {
      class NoNumbers extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", { format: { without: /\d/ } });
        }
      }

      it("accepts values not matching 'without'", () => {
        expect(new NoNumbers({ name: "dean" }).isValid()).toBe(true);
      });

      it("rejects values matching 'without'", () => {
        const n = new NoNumbers({ name: "dean123" });
        expect(n.isValid()).toBe(false);
        expect(n.errors.get("name")).toContain("is invalid");
      });
    });

    describe("numericality comparison operators", () => {
      it("greaterThanOrEqualTo", () => {
        class GTE extends Model {
          static {
            this.attribute("age", "integer");
            this.validates("age", { numericality: { greaterThanOrEqualTo: 18 } });
          }
        }
        expect(new GTE({ age: 18 }).isValid()).toBe(true);
        expect(new GTE({ age: 17 }).isValid()).toBe(false);
      });

      it("lessThanOrEqualTo", () => {
        class LTE extends Model {
          static {
            this.attribute("rating", "integer");
            this.validates("rating", { numericality: { lessThanOrEqualTo: 5 } });
          }
        }
        expect(new LTE({ rating: 5 }).isValid()).toBe(true);
        expect(new LTE({ rating: 6 }).isValid()).toBe(false);
      });

      it("equalTo", () => {
        class EQ extends Model {
          static {
            this.attribute("answer", "integer");
            this.validates("answer", { numericality: { equalTo: 42 } });
          }
        }
        expect(new EQ({ answer: 42 }).isValid()).toBe(true);
        expect(new EQ({ answer: 41 }).isValid()).toBe(false);
      });

      it("otherThan", () => {
        class OT extends Model {
          static {
            this.attribute("count", "integer");
            this.validates("count", { numericality: { otherThan: 0 } });
          }
        }
        expect(new OT({ count: 1 }).isValid()).toBe(true);
        expect(new OT({ count: 0 }).isValid()).toBe(false);
      });
    });

    describe("inclusion allowNil", () => {
      it("skips nil by default", () => {
        class WithNil extends Model {
          static {
            this.attribute("status", "string");
            this.validates("status", { inclusion: { in: ["a", "b"] } });
          }
        }
        expect(new WithNil({}).isValid()).toBe(true);
      });

      it("validates nil when allowNil is false", () => {
        class NoNil extends Model {
          static {
            this.attribute("status", "string");
            this.validates("status", { inclusion: { in: ["a", "b"], allowNil: false } });
          }
        }
        expect(new NoNil({}).isValid()).toBe(false);
      });
    });

    describe("exclusion allowNil", () => {
      it("skips nil by default", () => {
        class WithNil extends Model {
          static {
            this.attribute("role", "string");
            this.validates("role", { exclusion: { in: ["admin"] } });
          }
        }
        expect(new WithNil({}).isValid()).toBe(true);
      });
    });

    describe("acceptance skips nil", () => {
      it("skips nil by default", () => {
        class Terms extends Model {
          static {
            this.attribute("terms", "string");
            this.validates("terms", { acceptance: true });
          }
        }
        expect(new Terms({}).isValid()).toBe(true);
      });
    });

    describe("custom messages", () => {
      it("presence with custom message", () => {
        class Custom extends Model {
          static {
            this.attribute("name", "string");
            this.validates("name", { presence: { message: "is required" } });
          }
        }
        const c = new Custom();
        c.isValid();
        expect(c.errors.get("name")).toContain("is required");
      });

      it("length with custom tooShort and tooLong", () => {
        class Custom extends Model {
          static {
            this.attribute("name", "string");
            this.validates("name", {
              length: { minimum: 3, maximum: 5, tooShort: "too few!", tooLong: "too many!" },
            });
          }
        }
        const short = new Custom({ name: "ab" });
        short.isValid();
        expect(short.errors.get("name")).toContain("too few!");

        const long = new Custom({ name: "abcdef" });
        long.isValid();
        expect(long.errors.get("name")).toContain("too many!");
      });
    });
  });

  // =========================================================================
  // Callbacks — after_validation
  // =========================================================================
  describe("Callbacks (extended)", () => {
    it("afterValidation runs after validation", () => {
      const order: string[] = [];
      class Validated extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", { presence: true });
          this.afterValidation(() => { order.push("after_validation"); });
        }
      }
      const v = new Validated({ name: "dean" });
      v.isValid();
      expect(order).toContain("after_validation");
    });

    it("afterValidation runs even when invalid", () => {
      const order: string[] = [];
      class Validated extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", { presence: true });
          this.afterValidation(() => { order.push("after_validation"); });
        }
      }
      const v = new Validated();
      v.isValid();
      expect(order).toContain("after_validation");
    });

    it("callback inheritance — child inherits parent callbacks", () => {
      const order: string[] = [];
      class Parent extends Model {
        static {
          this.attribute("name", "string");
          this.beforeSave(() => { order.push("parent_before"); });
        }
      }
      class Child extends Parent {
        static {
          this.beforeSave(() => { order.push("child_before"); });
        }
      }
      const c = new Child();
      c.runCallbacks("save", () => { order.push("action"); });
      expect(order).toContain("parent_before");
      expect(order).toContain("child_before");
      expect(order.indexOf("parent_before")).toBeLessThan(order.indexOf("child_before"));
    });

    it("child callbacks do not affect parent", () => {
      const parentOrder: string[] = [];
      const childOrder: string[] = [];
      class Parent extends Model {
        static {
          this.attribute("name", "string");
          this.beforeSave(() => { parentOrder.push("parent"); childOrder.push("parent"); });
        }
      }
      class Child extends Parent {
        static {
          this.beforeSave(() => { childOrder.push("child"); });
        }
      }
      new Parent().runCallbacks("save", () => { parentOrder.push("action"); });
      expect(parentOrder).not.toContain("child");
    });

    it("custom validate with method name string", () => {
      class WithMethod extends Model {
        static {
          this.attribute("value", "integer");
          this.validate("validateCustom");
        }
        validateCustom() {
          if (this.readAttribute("value") === 0) {
            this.errors.add("value", "invalid", { message: "cannot be zero" });
          }
        }
      }
      expect(new WithMethod({ value: 1 }).isValid()).toBe(true);
      const w = new WithMethod({ value: 0 });
      expect(w.isValid()).toBe(false);
      expect(w.errors.get("value")).toContain("cannot be zero");
    });
  });

  // =========================================================================
  // ComparisonValidator
  // =========================================================================
  describe("ComparisonValidator", () => {
    it("validates greaterThan", () => {
      class Order extends Model {
        static {
          this.attribute("quantity", "integer");
          this.validates("quantity", { comparison: { greaterThan: 0 } });
        }
      }
      expect(new Order({ quantity: 5 }).isValid()).toBe(true);
      expect(new Order({ quantity: 0 }).isValid()).toBe(false);
      expect(new Order({ quantity: -1 }).isValid()).toBe(false);
    });

    it("validates greaterThanOrEqualTo", () => {
      class Order extends Model {
        static {
          this.attribute("quantity", "integer");
          this.validates("quantity", { comparison: { greaterThanOrEqualTo: 1 } });
        }
      }
      expect(new Order({ quantity: 1 }).isValid()).toBe(true);
      expect(new Order({ quantity: 0 }).isValid()).toBe(false);
    });

    it("validates lessThan", () => {
      class Rating extends Model {
        static {
          this.attribute("score", "integer");
          this.validates("score", { comparison: { lessThan: 10 } });
        }
      }
      expect(new Rating({ score: 9 }).isValid()).toBe(true);
      expect(new Rating({ score: 10 }).isValid()).toBe(false);
    });

    it("validates lessThanOrEqualTo", () => {
      class Rating extends Model {
        static {
          this.attribute("score", "integer");
          this.validates("score", { comparison: { lessThanOrEqualTo: 10 } });
        }
      }
      expect(new Rating({ score: 10 }).isValid()).toBe(true);
      expect(new Rating({ score: 11 }).isValid()).toBe(false);
    });

    it("validates equalTo", () => {
      class Confirmation extends Model {
        static {
          this.attribute("value", "integer");
          this.validates("value", { comparison: { equalTo: 42 } });
        }
      }
      expect(new Confirmation({ value: 42 }).isValid()).toBe(true);
      expect(new Confirmation({ value: 43 }).isValid()).toBe(false);
    });

    it("validates otherThan", () => {
      class Item extends Model {
        static {
          this.attribute("status", "integer");
          this.validates("status", { comparison: { otherThan: 0 } });
        }
      }
      expect(new Item({ status: 1 }).isValid()).toBe(true);
      expect(new Item({ status: 0 }).isValid()).toBe(false);
    });

    it("supports function comparands (like Rails procs)", () => {
      class Event extends Model {
        static {
          this.attribute("startDate", "date");
          this.attribute("endDate", "date");
          this.validates("endDate", {
            comparison: { greaterThan: (record: any) => record.readAttribute("startDate") },
          });
        }
      }
      const valid = new Event({
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-02"),
      });
      expect(valid.isValid()).toBe(true);

      const invalid = new Event({
        startDate: new Date("2024-01-02"),
        endDate: new Date("2024-01-01"),
      });
      expect(invalid.isValid()).toBe(false);
    });

    it("works with dates", () => {
      const tomorrow = new Date("2024-06-02");
      class Booking extends Model {
        static {
          this.attribute("checkIn", "date");
          this.validates("checkIn", { comparison: { greaterThanOrEqualTo: tomorrow } });
        }
      }
      expect(new Booking({ checkIn: new Date("2024-06-02") }).isValid()).toBe(true);
      expect(new Booking({ checkIn: new Date("2024-06-01") }).isValid()).toBe(false);
    });

    it("works with strings", () => {
      class Item extends Model {
        static {
          this.attribute("code", "string");
          this.validates("code", { comparison: { greaterThan: "A" } });
        }
      }
      expect(new Item({ code: "B" }).isValid()).toBe(true);
      expect(new Item({ code: "A" }).isValid()).toBe(false);
    });

    it("skips nil values", () => {
      class Item extends Model {
        static {
          this.attribute("quantity", "integer");
          this.validates("quantity", { comparison: { greaterThan: 0 } });
        }
      }
      expect(new Item({}).isValid()).toBe(true);
    });

    it("supports custom message", () => {
      class Item extends Model {
        static {
          this.attribute("qty", "integer");
          this.validates("qty", {
            comparison: { greaterThan: 0, message: "must be positive" },
          });
        }
      }
      const item = new Item({ qty: 0 });
      expect(item.isValid()).toBe(false);
      expect(item.errors.fullMessages).toContain("Qty must be positive");
    });

    it("supports multiple constraints", () => {
      class Score extends Model {
        static {
          this.attribute("value", "integer");
          this.validates("value", {
            comparison: { greaterThanOrEqualTo: 0, lessThanOrEqualTo: 100 },
          });
        }
      }
      expect(new Score({ value: 50 }).isValid()).toBe(true);
      expect(new Score({ value: -1 }).isValid()).toBe(false);
      expect(new Score({ value: 101 }).isValid()).toBe(false);
    });
  });

  // =========================================================================
  // UUID Type
  // =========================================================================
  describe("UuidType", () => {
    it("casts a valid UUID to lowercase", () => {
      class Item extends Model {
        static {
          this.attribute("uuid", "uuid");
        }
      }
      const item = new Item({ uuid: "550E8400-E29B-41D4-A716-446655440000" });
      expect(item.readAttribute("uuid")).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("returns null for invalid UUID", () => {
      class Item extends Model {
        static {
          this.attribute("uuid", "uuid");
        }
      }
      const item = new Item({ uuid: "not-a-uuid" });
      expect(item.readAttribute("uuid")).toBe(null);
    });

    it("handles null", () => {
      class Item extends Model {
        static {
          this.attribute("uuid", "uuid");
        }
      }
      const item = new Item({});
      expect(item.readAttribute("uuid")).toBe(null);
    });
  });

  // =========================================================================
  // JSON Type
  // =========================================================================
  describe("JsonType", () => {
    it("casts a JSON string to parsed object", () => {
      class Config extends Model {
        static {
          this.attribute("data", "json");
        }
      }
      const c = new Config({ data: '{"key":"value"}' });
      expect(c.readAttribute("data")).toEqual({ key: "value" });
    });

    it("passes through objects", () => {
      class Config extends Model {
        static {
          this.attribute("data", "json");
        }
      }
      const c = new Config({ data: { key: "value" } });
      expect(c.readAttribute("data")).toEqual({ key: "value" });
    });

    it("returns null for invalid JSON string", () => {
      class Config extends Model {
        static {
          this.attribute("data", "json");
        }
      }
      const c = new Config({ data: "not json{" });
      expect(c.readAttribute("data")).toBe(null);
    });

    it("handles arrays", () => {
      class Config extends Model {
        static {
          this.attribute("tags", "json");
        }
      }
      const c = new Config({ tags: [1, 2, 3] });
      expect(c.readAttribute("tags")).toEqual([1, 2, 3]);
    });

    it("handles null", () => {
      class Config extends Model {
        static {
          this.attribute("data", "json");
        }
      }
      const c = new Config({});
      expect(c.readAttribute("data")).toBe(null);
    });
  });

  // =========================================================================
  // afterCommit / afterRollback callback registration
  // =========================================================================
  describe("afterCommit / afterRollback callbacks", () => {
    it("registers afterCommit callback", () => {
      class Order extends Model {
        static {
          this.attribute("total", "integer");
          this.afterCommit(() => {});
        }
      }
      // Should not throw
      expect(new Order({ total: 1 }).isValid()).toBe(true);
    });

    it("registers afterRollback callback", () => {
      class Order extends Model {
        static {
          this.attribute("total", "integer");
          this.afterRollback(() => {});
        }
      }
      expect(new Order({ total: 1 }).isValid()).toBe(true);
    });
  });

  // =================================================================
  // Phase: attribute_before_type_cast / hasAttribute
  // =================================================================
  describe("attributeBeforeTypeCast", () => {
    it("returns the raw value before type casting", () => {
      class Price extends Model {
        static {
          this.attribute("amount", "integer");
        }
      }

      const price = new Price({ amount: "42" });
      expect(price.readAttribute("amount")).toBe(42); // cast to integer
      expect(price.readAttributeBeforeTypeCast("amount")).toBe("42"); // raw string
    });

    it("tracks raw values on writeAttribute", () => {
      class Price extends Model {
        static {
          this.attribute("amount", "integer");
        }
      }

      const price = new Price({ amount: 10 });
      price.writeAttribute("amount", "99");
      expect(price.readAttribute("amount")).toBe(99);
      expect(price.readAttributeBeforeTypeCast("amount")).toBe("99");
    });
  });

  describe("willSaveChangeToAttribute", () => {
    it("returns true when attribute has been changed", () => {
      class Widget extends Model {
        static {
          this.attribute("name", "string");
          this.attribute("size", "integer");
        }
      }

      const w = new Widget({ name: "Test", size: 5 });
      w.changesApplied();
      w.writeAttribute("name", "Changed");
      expect(w.willSaveChangeToAttribute("name")).toBe(true);
      expect(w.willSaveChangeToAttribute("size")).toBe(false);
    });

    it("willSaveChangeToAttributeValues returns [old, new]", () => {
      class Widget extends Model {
        static {
          this.attribute("name", "string");
        }
      }

      const w = new Widget({ name: "Test" });
      w.changesApplied();
      w.writeAttribute("name", "Changed");
      expect(w.willSaveChangeToAttributeValues("name")).toEqual(["Test", "Changed"]);
    });
  });

  describe("attributeInDatabase / attributeBeforeLastSave / changedAttributeNamesToSave", () => {
    it("attributeInDatabase returns the pre-change value", () => {
      class Widget extends Model {
        static {
          this.attribute("name", "string");
        }
      }

      const w = new Widget({ name: "Test" });
      w.changesApplied();
      w.writeAttribute("name", "Changed");
      expect(w.attributeInDatabase("name")).toBe("Test");
    });

    it("attributeBeforeLastSave returns old value after save", () => {
      class Widget extends Model {
        static {
          this.attribute("name", "string");
        }
      }

      const w = new Widget({ name: "Original" });
      w.changesApplied();
      w.writeAttribute("name", "Updated");
      w.changesApplied();
      expect(w.attributeBeforeLastSave("name")).toBe("Original");
    });

    it("changedAttributeNamesToSave lists pending changes", () => {
      class Widget extends Model {
        static {
          this.attribute("name", "string");
          this.attribute("size", "integer");
        }
      }

      const w = new Widget({ name: "Test", size: 5 });
      w.changesApplied();
      w.writeAttribute("name", "Changed");
      expect(w.changedAttributeNamesToSave).toContain("name");
      expect(w.changedAttributeNamesToSave).not.toContain("size");
    });
  });

  describe("hasAttribute", () => {
    it("returns true for defined attributes", () => {
      class Widget extends Model {
        static {
          this.attribute("name", "string");
          this.attribute("size", "integer");
        }
      }

      const w = new Widget({ name: "Test" });
      expect(w.hasAttribute("name")).toBe(true);
      expect(w.hasAttribute("size")).toBe(true);
      expect(w.hasAttribute("unknown")).toBe(false);
    });
  });

  describe("validatesEach", () => {
    it("validates each attribute with a block function", () => {
      class Payment extends Model {
        static {
          this.attribute("price", "integer");
          this.attribute("discount", "integer");
          this.validatesEach(["price", "discount"], (record, attr, value) => {
            if (typeof value === "number" && value < 0) {
              record.errors.add(attr, "invalid", { message: "must be non-negative" });
            }
          });
        }
      }

      const p = new Payment({ price: -5, discount: 10 });
      expect(p.isValid()).toBe(false);
      expect(p.errors.fullMessages).toContain("Price must be non-negative");

      const p2 = new Payment({ price: 5, discount: -3 });
      expect(p2.isValid()).toBe(false);
      expect(p2.errors.fullMessages).toContain("Discount must be non-negative");

      const p3 = new Payment({ price: 5, discount: 10 });
      expect(p3.isValid()).toBe(true);
    });

    it("supports conditional options", () => {
      class Payment extends Model {
        static {
          this.attribute("price", "integer");
          this.attribute("discount", "integer");
          this.validatesEach(["price", "discount"], (record, attr, value) => {
            if (typeof value === "number" && value < 0) {
              record.errors.add(attr, "invalid", { message: "must be non-negative" });
            }
          }, { if: (record) => record.readAttribute("price") !== null });
        }
      }

      const p = new Payment({ price: null, discount: -3 });
      expect(p.isValid()).toBe(true);
    });
  });

  describe("validatesWith", () => {
    it("validates using a custom validator class", () => {
      class EvenValidator {
        validate(record: any) {
          const val = record.readAttribute("count");
          if (typeof val === "number" && val % 2 !== 0) {
            record.errors.add("count", "invalid", { message: "must be even" });
          }
        }
      }

      class Item extends Model {
        static {
          this.attribute("count", "integer");
          this.validatesWith(EvenValidator);
        }
      }

      const item = new Item({ count: 3 });
      expect(item.isValid()).toBe(false);
      expect(item.errors.fullMessages).toContain("Count must be even");

      const item2 = new Item({ count: 4 });
      expect(item2.isValid()).toBe(true);
    });

    it("passes extra options to the validator constructor", () => {
      class ThresholdValidator {
        threshold: number;
        constructor(options: any = {}) {
          this.threshold = options.threshold ?? 10;
        }
        validate(record: any) {
          const val = record.readAttribute("score");
          if (typeof val === "number" && val < this.threshold) {
            record.errors.add("score", "invalid", { message: `must be at least ${this.threshold}` });
          }
        }
      }

      class Game extends Model {
        static {
          this.attribute("score", "integer");
          this.validatesWith(ThresholdValidator, { threshold: 50 });
        }
      }

      const g = new Game({ score: 30 });
      expect(g.isValid()).toBe(false);
      expect(g.errors.fullMessages).toContain("Score must be at least 50");

      const g2 = new Game({ score: 60 });
      expect(g2.isValid()).toBe(true);
    });

    it("supports conditional options", () => {
      class AlwaysInvalidValidator {
        validate(record: any) {
          record.errors.add("base", "invalid", { message: "always invalid" });
        }
      }

      class Widget extends Model {
        static {
          this.attribute("active", "boolean");
          this.validatesWith(AlwaysInvalidValidator, { if: (r: any) => r.readAttribute("active") === true });
        }
      }

      const w = new Widget({ active: false });
      expect(w.isValid()).toBe(true);

      const w2 = new Widget({ active: true });
      expect(w2.isValid()).toBe(false);
    });
  });

  describe("clearChangesInformation", () => {
    it("clears both current and previous changes", () => {
      class Person extends Model {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
        }
      }

      const p = new Person({ name: "Alice", age: 30 });
      p.changesApplied(); // snapshot as clean
      p.writeAttribute("name", "Bob");
      p.changesApplied(); // this makes name change a "previous change"
      expect(Object.keys(p.previousChanges).length).toBeGreaterThan(0);

      // Now make another current change
      p.writeAttribute("age", 31);
      expect(p.changed).toBe(true);

      p.clearChangesInformation();
      expect(p.changed).toBe(false);
      expect(Object.keys(p.previousChanges).length).toBe(0);
    });
  });

  describe("clearAttributeChanges", () => {
    it("clears changes for specific attributes only", () => {
      class Person extends Model {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
        }
      }

      const p = new Person({ name: "Alice", age: 30 });
      p.changesApplied();
      p.writeAttribute("name", "Bob");
      p.writeAttribute("age", 31);
      expect(p.changedAttributes).toContain("name");
      expect(p.changedAttributes).toContain("age");

      p.clearAttributeChanges(["name"]);
      expect(p.changedAttributes).not.toContain("name");
      expect(p.changedAttributes).toContain("age");
    });
  });

  describe("normalizes", () => {
    it("applies normalization on write", () => {
      class User extends Model {
        static {
          this.attribute("email", "string");
          this.normalizes("email", (v: unknown) =>
            typeof v === "string" ? v.trim().toLowerCase() : v
          );
        }
      }

      const u = new User({ email: "  Alice@Example.COM  " });
      expect(u.readAttribute("email")).toBe("alice@example.com");
    });

    it("applies normalization on subsequent writeAttribute", () => {
      class User extends Model {
        static {
          this.attribute("name", "string");
          this.normalizes("name", (v: unknown) =>
            typeof v === "string" ? v.trim() : v
          );
        }
      }

      const u = new User({ name: "Alice" });
      u.writeAttribute("name", "  Bob  ");
      expect(u.readAttribute("name")).toBe("Bob");
    });

    it("supports multiple attributes", () => {
      class User extends Model {
        static {
          this.attribute("first_name", "string");
          this.attribute("last_name", "string");
          this.normalizes("first_name", "last_name", (v: unknown) =>
            typeof v === "string" ? v.toUpperCase() : v
          );
        }
      }

      const u = new User({ first_name: "alice", last_name: "smith" });
      expect(u.readAttribute("first_name")).toBe("ALICE");
      expect(u.readAttribute("last_name")).toBe("SMITH");
    });
  });

  describe("attributeChanged with from/to options", () => {
    it("returns true when from/to match the change", () => {
      class User extends Model {
        static { this.attribute("name", "string"); }
      }
      const u = new User({ name: "Alice" });
      u.changesApplied();
      u.writeAttribute("name", "Bob");
      expect(u.attributeChanged("name", { from: "Alice", to: "Bob" })).toBe(true);
    });

    it("returns false when from does not match", () => {
      class User extends Model {
        static { this.attribute("name", "string"); }
      }
      const u = new User({ name: "Alice" });
      u.changesApplied();
      u.writeAttribute("name", "Bob");
      expect(u.attributeChanged("name", { from: "Charlie", to: "Bob" })).toBe(false);
    });

    it("returns false when to does not match", () => {
      class User extends Model {
        static { this.attribute("name", "string"); }
      }
      const u = new User({ name: "Alice" });
      u.changesApplied();
      u.writeAttribute("name", "Bob");
      expect(u.attributeChanged("name", { from: "Alice", to: "Charlie" })).toBe(false);
    });

    it("supports only from option", () => {
      class User extends Model {
        static { this.attribute("name", "string"); }
      }
      const u = new User({ name: "Alice" });
      u.changesApplied();
      u.writeAttribute("name", "Bob");
      expect(u.attributeChanged("name", { from: "Alice" })).toBe(true);
      expect(u.attributeChanged("name", { from: "Wrong" })).toBe(false);
    });

    it("supports only to option", () => {
      class User extends Model {
        static { this.attribute("name", "string"); }
      }
      const u = new User({ name: "Alice" });
      u.changesApplied();
      u.writeAttribute("name", "Bob");
      expect(u.attributeChanged("name", { to: "Bob" })).toBe(true);
      expect(u.attributeChanged("name", { to: "Wrong" })).toBe(false);
    });

    it("willSaveChangeToAttribute supports from/to", () => {
      class User extends Model {
        static { this.attribute("name", "string"); }
      }
      const u = new User({ name: "Alice" });
      u.changesApplied();
      u.writeAttribute("name", "Bob");
      expect(u.willSaveChangeToAttribute("name", { from: "Alice", to: "Bob" })).toBe(true);
      expect(u.willSaveChangeToAttribute("name", { from: "Wrong" })).toBe(false);
    });

    it("savedChangeToAttribute supports from/to", () => {
      class User extends Model {
        static { this.attribute("name", "string"); }
      }
      const u = new User({ name: "Alice" });
      u.changesApplied();
      u.writeAttribute("name", "Bob");
      u.changesApplied();
      expect(u.savedChangeToAttribute("name", { from: "Alice", to: "Bob" })).toBe(true);
      expect(u.savedChangeToAttribute("name", { from: "Alice", to: "Wrong" })).toBe(false);
      expect(u.savedChangeToAttribute("name", { from: "Wrong", to: "Bob" })).toBe(false);
    });
  });

  describe("errors.fullMessagesFor()", () => {
    it("returns full messages for a specific attribute", () => {
      class User extends Model {
        static {
          this.attribute("name", "string");
          this.attribute("email", "string");
          this.validates("name", { presence: true });
          this.validates("email", { presence: true });
        }
      }
      const u = new User({});
      u.isValid();
      expect(u.errors.fullMessagesFor("name")).toEqual(["Name can't be blank"]);
      expect(u.errors.fullMessagesFor("email")).toEqual(["Email can't be blank"]);
      expect(u.errors.fullMessagesFor("other")).toEqual([]);
    });
  });

  describe("errors.ofKind()", () => {
    it("checks if error of specific kind exists", () => {
      class User extends Model {
        static {
          this.attribute("name", "string");
          this.validates("name", { presence: true });
        }
      }
      const u = new User({});
      u.isValid();
      expect(u.errors.ofKind("name", "blank")).toBe(true);
      expect(u.errors.ofKind("name", "invalid")).toBe(false);
      expect(u.errors.ofKind("name")).toBe(true);
      expect(u.errors.ofKind("other")).toBe(false);
    });
  });

  describe("attributesBeforeTypeCast", () => {
    it("returns all raw attribute values", () => {
      class User extends Model {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
        }
      }
      const u = new User({ name: "Alice", age: "25" });
      const raw = u.attributesBeforeTypeCast;
      expect(raw.name).toBe("Alice");
      expect(raw.age).toBe("25"); // raw, not cast to integer
      expect(u.readAttribute("age")).toBe(25); // cast version
    });
  });

  describe("columnForAttribute()", () => {
    it("returns type info for defined attribute", () => {
      class User extends Model {
        static {
          this.attribute("name", "string");
          this.attribute("age", "integer");
        }
      }
      const u = new User({ name: "Alice", age: 25 });
      const col = u.columnForAttribute("name");
      expect(col).not.toBeNull();
      expect(col!.name).toBe("name");

      const ageCol = u.columnForAttribute("age");
      expect(ageCol).not.toBeNull();
      expect(ageCol!.name).toBe("age");
    });

    it("returns null for unknown attribute", () => {
      class User extends Model {
        static { this.attribute("name", "string"); }
      }
      const u = new User({ name: "Alice" });
      expect(u.columnForAttribute("nonexistent")).toBeNull();
    });
  });

  describe("humanAttributeName()", () => {
    it("humanizes attribute names at the Model level", () => {
      class User extends Model {
        static { this.attribute("first_name", "string"); }
      }
      expect(User.humanAttributeName("first_name")).toBe("First name");
      expect(User.humanAttributeName("email")).toBe("Email");
    });
  });

  describe("defineModelCallbacks()", () => {
    it("creates before/after/around methods for custom events", () => {
      class Payment extends Model {
        static {
          this.attribute("amount", "integer");
          this.defineModelCallbacks("process", "refund");
        }
      }

      const log: string[] = [];
      (Payment as any).beforeProcess((record: any) => {
        log.push("before_process");
      });
      (Payment as any).afterProcess((record: any) => {
        log.push("after_process");
      });

      const p = new Payment({ amount: 100 });
      // Run callbacks manually
      (Payment as any)._callbackChain.runBefore("process", p);
      (Payment as any)._callbackChain.runAfter("process", p);
      expect(log).toEqual(["before_process", "after_process"]);
    });

    it("creates around callback", () => {
      class Payment extends Model {
        static {
          this.attribute("amount", "integer");
          this.defineModelCallbacks("charge");
        }
      }

      expect(typeof (Payment as any).aroundCharge).toBe("function");
    });
  });
});
