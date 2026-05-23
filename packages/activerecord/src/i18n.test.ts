import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Base } from "./index.js";
import { I18n } from "@blazetrails/activemodel";
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
  await defineSchema({ topics: { title: "string" } });
  const raw = Base.adapter;
  _txAdapter = new Proxy(raw, {
    get(target, prop) {
      if (prop === "pool") return null;
      return Reflect.get(target, prop, target);
    },
  }) as unknown as TransactionalFixturesAdapter;
});
beforeEach(() => {
  I18n.reset();
});
withTransactionalFixtures(() => _txAdapter!);
afterAll(async () => {
  const adapter = Base.adapter;
  await dropAllTables(adapter);
  clearAppliedSchemaSignatures(adapter);
});

describe("ActiveRecordI18nTests", () => {
  it("translated model attributes", () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
      }
    }

    I18n.storeTranslations("en", {
      activerecord: { attributes: { topic: { title: "topic title attribute" } } },
    });

    expect(Topic.humanAttributeName("title")).toBe("topic title attribute");
  });

  it("translated model attributes with symbols", () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
      }
    }

    I18n.storeTranslations("en", {
      activerecord: { attributes: { topic: { title: "topic title attribute" } } },
    });

    expect(Topic.humanAttributeName("title")).toBe("topic title attribute");
  });

  it("translated model attributes with sti", () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    class Reply extends Topic {}

    I18n.storeTranslations("en", {
      activerecord: { attributes: { reply: { title: "reply title attribute" } } },
    });

    expect(Reply.humanAttributeName("title")).toBe("reply title attribute");
  });

  it("translated model attributes with sti fallback", () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    class Reply extends Topic {}

    I18n.storeTranslations("en", {
      activerecord: { attributes: { topic: { title: "topic title attribute" } } },
    });

    expect(Reply.humanAttributeName("title")).toBe("topic title attribute");
  });

  it("translated model names", () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
      }
    }

    I18n.storeTranslations("en", {
      activerecord: { models: { topic: "topic model" } },
    });

    expect(Topic.modelName.human).toBe("topic model");
  });

  it("translated model names with sti", () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    class Reply extends Topic {}

    I18n.storeTranslations("en", {
      activerecord: { models: { reply: "reply model" } },
    });

    expect(Reply.modelName.human).toBe("reply model");
  });

  it("translated model names with sti fallback", () => {
    class Topic extends Base {
      static {
        this.attribute("title", "string");
      }
    }
    class Reply extends Topic {}

    I18n.storeTranslations("en", {
      activerecord: { models: { topic: "topic model" } },
    });

    expect(Reply.modelName.human).toBe("topic model");
  });
});
