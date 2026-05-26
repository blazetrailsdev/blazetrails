import { describe, it, expect, beforeAll } from "vitest";
import { Base } from "../index.js";
import { Author } from "../test-helpers/models/author.js";
import { defineSchema } from "../test-helpers/define-schema.js";
import { setupHandlerSuite } from "../test-helpers/setup-handler-suite.js";
import { useHandlerTransactionalFixtures } from "../test-helpers/use-handler-transactional-fixtures.js";
import { useFixtures } from "../test-helpers/use-fixtures.js";
import { TEST_SCHEMA } from "../test-helpers/test-schema.js";

setupHandlerSuite();
useHandlerTransactionalFixtures();
beforeAll(async () => {
  await defineSchema({ authors: TEST_SCHEMA.authors });
  await Author.loadSchema();
});

const { authors } = useFixtures(
  {
    authors: [
      Author,
      {
        sean: { name: "Sean" },
      },
    ],
  },
  () => Base.adapter,
);

describe("StringTypeTest", () => {
  it("string mutations are detected", async () => {
    const author = await Author.find(authors("sean").id);
    expect(author.changed).toBe(false);

    // JS strings are immutable; assignment goes through the setter rather than mutating in place.
    // nameChanged() fires via dirty-tracker change detection, not isChangedInPlace.
    author.name = String(author.name) + " Griffin";
    expect((author as any).attributeChanged("name")).toBe(true);

    await author.save();
    await author.reload();

    expect(author.name).toBe("Sean Griffin");
    expect(author.changed).toBe(false);
  });
});
