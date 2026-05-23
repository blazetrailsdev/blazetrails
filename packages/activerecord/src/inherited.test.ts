import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Base } from "./index.js";
import { defineSchema, clearAppliedSchemaSignatures } from "./test-helpers/define-schema.js";
import {
  withTransactionalFixtures,
  type TransactionalFixturesAdapter,
} from "./test-helpers/with-transactional-fixtures.js";
import { setupHandlerSuite } from "./test-helpers/setup-handler-suite.js";
import { dropAllTables } from "./test-helpers/drop-all-tables.js";
setupHandlerSuite();
let _txAdapter: TransactionalFixturesAdapter | null = null;
beforeAll(async () => {
  await defineSchema({
    parents: { name: "string" },
    children: { name: "string" },
  });
  const raw = Base.adapter;
  _txAdapter = new Proxy(raw, {
    get(target, prop) {
      if (prop === "pool") return null;
      return Reflect.get(target, prop, target);
    },
  }) as unknown as TransactionalFixturesAdapter;
});
withTransactionalFixtures(() => _txAdapter!);
afterAll(async () => {
  const adapter = Base.adapter;
  await dropAllTables(adapter);
  clearAppliedSchemaSignatures(adapter);
});

describe("InheritedTest", () => {
  it("super before filter attributes", async () => {
    const log: string[] = [];
    class Parent extends Base {
      static {
        this.attribute("name", "string");
        this.beforeCreate(function () {
          log.push("parent_before");
        });
      }
    }
    class Child extends Parent {
      static {
        this.beforeCreate(function () {
          log.push("child_before");
        });
      }
    }
    await Child.create({ name: "test" });
    expect(log).toContain("parent_before");
    expect(log).toContain("child_before");
    expect(log.indexOf("parent_before")).toBeLessThan(log.indexOf("child_before"));
  });

  it("super after filter attributes", async () => {
    const log: string[] = [];
    class Parent extends Base {
      static {
        this.attribute("name", "string");
        this.afterCreate(function () {
          log.push("parent_after");
        });
      }
    }
    class Child extends Parent {
      static {
        this.afterCreate(function () {
          log.push("child_after");
        });
      }
    }
    await Child.create({ name: "test" });
    expect(log).toContain("parent_after");
    expect(log).toContain("child_after");
  });
});
