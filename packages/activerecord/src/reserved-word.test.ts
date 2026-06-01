import { describe, it, expect } from "vitest";
import { Base } from "./index.js";
import "./relation.js";
import { useHandlerFixtures } from "./test-helpers/use-handler-fixtures.js";
import { TEST_SCHEMA as canonicalSchema } from "./test-helpers/test-schema.js";
import { reservedWordsGroupFixtureData } from "./test-helpers/fixtures/reserved-words/group.js";

// Test-file-local classes mirror Rails' `ReservedWordTest::Group` etc. — the
// tables and columns are SQL reserved words, so they exercise identifier
// quoting throughout AR. There is no shared canonical model for these.
class Group extends Base {
  static tableName = "group";
}
class Select extends Base {
  static tableName = "select";
}
class Values extends Base {
  static tableName = "values";
  static primaryKey = "as";
}
class Distinct extends Base {
  static tableName = "distinct";
}

// Mirrors Rails `use_instantiated_fixtures = true` + the custom
// `create_test_fixtures :group` loader: seed the canonical reserved-word
// `group` rows and read them through the accessor. `schema` recreates the
// canonical `group` table (sliced from TEST_SCHEMA) so the columns and rows
// resolve regardless of any bespoke `group` a sibling file left in the shared
// worker DB.
const { groups } = useHandlerFixtures(
  { groups: [Group, reservedWordsGroupFixtureData] },
  { schema: canonicalSchema },
);

describe("ReservedWordTest", () => {
  it.skip("create tables", () => {
    // BLOCKED: schema — schema introspection / dumper gap in reserved-word
    // ROOT-CAUSE: reserved-word.ts or abstract/schema-statements.ts missing Rails parity
    // SCOPE: ~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in reserved-word.test.ts
  });
  it.skip("rename tables", () => {
    // BLOCKED: schema — schema introspection / dumper gap in reserved-word
    // ROOT-CAUSE: reserved-word.ts or abstract/schema-statements.ts missing Rails parity
    // SCOPE: ~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in reserved-word.test.ts
  });
  it.skip("change columns", () => {
    // BLOCKED: schema — schema introspection / dumper gap in reserved-word
    // ROOT-CAUSE: reserved-word.ts or abstract/schema-statements.ts missing Rails parity
    // SCOPE: ~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in reserved-word.test.ts
  });
  it.skip("introspect", () => {
    // BLOCKED: schema — schema introspection / dumper gap in reserved-word
    // ROOT-CAUSE: reserved-word.ts or abstract/schema-statements.ts missing Rails parity
    // SCOPE: ~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in reserved-word.test.ts
  });

  it("activerecord model", async () => {
    const x = new Group();
    x.writeAttribute("order", "order_val_a");
    await x.save();
    x.writeAttribute("order", "order_val_b");
    await x.save();
    const found = await Group.findBy({ order: "order_val_b" });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(x.id);
  });

  it.skip("delete all with subselect", () => {
    // BLOCKED: schema — schema introspection / dumper gap in reserved-word
    // ROOT-CAUSE: reserved-word.ts or abstract/schema-statements.ts missing Rails parity
    // SCOPE: ~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in reserved-word.test.ts
  });
  it.skip("has one associations", () => {
    // BLOCKED: schema — schema introspection / dumper gap in reserved-word
    // ROOT-CAUSE: reserved-word.ts or abstract/schema-statements.ts missing Rails parity
    // SCOPE: ~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in reserved-word.test.ts
  });
  it.skip("belongs to associations", () => {
    // BLOCKED: schema — schema introspection / dumper gap in reserved-word
    // ROOT-CAUSE: reserved-word.ts or abstract/schema-statements.ts missing Rails parity
    // SCOPE: ~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in reserved-word.test.ts
  });

  it("activerecord introspection", async () => {
    expect(await Group.tableExists()).toBe(true);
    const cols = Group.columns()
      .map((c: { name: string }) => c.name)
      .sort();
    expect(cols).toEqual(["id", "order", "select_id"]);
  });

  it("calculations work with reserved words", async () => {
    expect(groups("group1")).not.toBeNull();
    expect(await Group.count()).toBe(3);
  });

  it.skip("associations work with reserved words", () => {
    // BLOCKED: schema — schema introspection / dumper gap in reserved-word
    // ROOT-CAUSE: reserved-word.ts or abstract/schema-statements.ts missing Rails parity
    // SCOPE: ~50–200 LOC fix in schema-dumper.ts or schema-statements.ts; affects ~7–43 tests in reserved-word.test.ts
  });
});
