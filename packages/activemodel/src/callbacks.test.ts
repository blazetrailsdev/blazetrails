import { describe, it, expect } from "vitest";
import { Model } from "./index.js";
import { CallbackChain } from "./callbacks.js";

describe("CallbacksTest", () => {
  it("after callbacks are not executed if the block returns false", () => {
    const log: string[] = [];
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.beforeValidation((_r: any) => {
          log.push("before");
          return false;
        });
        this.afterValidation((_r: any) => {
          log.push("after");
        });
      }
    }
    const p = new Person({ name: "Alice" });
    p.isValid();
    expect(log).toContain("before");
    expect(log).not.toContain("after");
  });

  it("only selects which types of callbacks should be created from an array list", () => {
    const log: string[] = [];
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.beforeValidation(() => {
          log.push("before");
        });
        this.afterValidation(() => {
          log.push("after");
        });
      }
    }
    const p = new Person({ name: "test" });
    p.isValid();
    expect(log).toContain("before");
    expect(log).toContain("after");
  });

  it("no callbacks should be created", () => {
    class Person extends Model {
      static {
        this.attribute("name", "string");
      }
    }
    const p = new Person({ name: "test" });
    expect(p.isValid()).toBe(true);
  });

  it("after_create callbacks with both callbacks declared in different lines", async () => {
    const log: string[] = [];
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.afterCreate(() => {
          log.push("first");
        });
        this.afterCreate(() => {
          log.push("second");
        });
      }
    }
    const p = new Person({ name: "test" });
    (p.constructor as typeof Model)._callbackChain.runAfter("create", p);
    expect(log).toEqual(["first", "second"]);
  });

  it("complete callback chain", () => {
    const order: string[] = [];
    class Person extends Model {
      static {
        this.beforeSave(() => {
          order.push("before_save");
        });
        this.aroundSave((_r, proceed) => {
          order.push("around_before");
          proceed();
          order.push("around_after");
        });
        this.afterSave(() => {
          order.push("after_save");
        });
      }
    }
    new Person().runCallbacks("save", () => {
      order.push("save");
    });
    expect(order).toEqual(["before_save", "around_before", "save", "around_after", "after_save"]);
  });

  it("the callback chain is halted when a callback throws :abort", () => {
    const order: string[] = [];
    class Person extends Model {
      static {
        this.beforeSave(() => {
          order.push("first");
        });
        this.beforeSave(() => {
          order.push("halt");
          return false;
        });
        this.beforeSave(() => {
          order.push("never");
        });
        this.afterSave(() => {
          order.push("after");
        });
      }
    }
    const result = new Person().runCallbacks("save", () => {
      order.push("action");
    });
    expect(result).toBe(false);
    expect(order).toContain("halt");
    expect(order).not.toContain("never");
    expect(order).not.toContain("action");
    expect(order).not.toContain("after");
  });

  it("only selects which types of callbacks should be created", () => {
    // Test that before/after/around create callbacks exist
    const order: string[] = [];
    class Person extends Model {
      static {
        this.beforeCreate(() => {
          order.push("before_create");
        });
        this.afterCreate(() => {
          order.push("after_create");
        });
      }
    }
    new Person().runCallbacks("create", () => {
      order.push("create");
    });
    expect(order).toEqual(["before_create", "create", "after_create"]);
  });

  it("after_create callbacks with both callbacks declared in one line", () => {
    const order: string[] = [];
    class Person extends Model {
      static {
        this.afterCreate(() => {
          order.push("first_after");
        });
        this.afterCreate(() => {
          order.push("second_after");
        });
      }
    }
    new Person().runCallbacks("create", () => {
      order.push("create");
    });
    expect(order).toEqual(["create", "first_after", "second_after"]);
  });

  it("the callback chain is not halted when around or after callbacks return false", () => {
    const log: string[] = [];
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.afterValidation((_r: any) => {
          log.push("after1");
          return false;
        });
        this.afterValidation((_r: any) => {
          log.push("after2");
        });
      }
    }
    const p = new Person({ name: "Alice" });
    p.isValid();
    expect(log).toEqual(["after1", "after2"]);
  });

  it("the :if option array should not be mutated by an after callback", () => {
    const conditions = { if: (_r: any) => true };
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.afterValidation((_r: any) => {}, conditions);
      }
    }
    const p = new Person({ name: "Alice" });
    p.isValid();
    expect(typeof conditions.if).toBe("function");
  });

  it("the callback chain is not halted when a before callback returns false)", () => {
    const log: string[] = [];
    class MyModel extends Model {
      static {
        this.attribute("name", "string");
        this.beforeValidation(() => {
          log.push("before");
        });
        this.afterValidation(() => {
          log.push("after");
        });
      }
    }
    const m = new MyModel({ name: "test" });
    m.isValid();
    expect(log).toContain("before");
    expect(log).toContain("after");
  });

  it("define_model_callbacks with only option limits timing types", () => {
    class Job extends Model {
      static {
        this.defineModelCallbacks("process", { only: ["before", "after"] });
      }
    }
    expect(typeof (Job as any).beforeProcess).toBe("function");
    expect(typeof (Job as any).afterProcess).toBe("function");
    expect((Job as any).aroundProcess).toBeUndefined();
  });

  it("define_model_callbacks with only: ['before'] creates only before", () => {
    class Task extends Model {
      static {
        this.defineModelCallbacks("execute", { only: ["before"] });
      }
    }
    expect(typeof (Task as any).beforeExecute).toBe("function");
    expect((Task as any).afterExecute).toBeUndefined();
    expect((Task as any).aroundExecute).toBeUndefined();
  });

  it("class-based callback object with before method", () => {
    const log: string[] = [];
    const auditor = {
      beforeValidation(record: any) {
        log.push(`auditing ${record.readAttribute("name")}`);
      },
    };
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.beforeValidation(auditor);
      }
    }
    const p = new Person({ name: "Alice" });
    p.isValid();
    expect(log).toContain("auditing Alice");
  });

  it("class-based callback object with snake_case method", () => {
    const log: string[] = [];
    const auditor = {
      before_validation(record: any) {
        log.push("snake_case called");
      },
    };
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.beforeValidation(auditor);
      }
    }
    new Person({ name: "test" }).isValid();
    expect(log).toContain("snake_case called");
  });

  it("class-based around callback object with proceed", () => {
    const log: string[] = [];
    const wrapper = {
      aroundSave(record: any, proceed: () => void) {
        log.push("around_before");
        proceed();
        log.push("around_after");
      },
    };
    class Person extends Model {
      static {
        this.attribute("name", "string");
        this.aroundSave(wrapper);
      }
    }
    const p = new Person({ name: "test" });
    p.runCallbacks("save", () => {
      log.push("save");
    });
    expect(log).toEqual(["around_before", "save", "around_after"]);
  });

  it("class-based callback via defineModelCallbacks-generated methods", () => {
    const log: string[] = [];
    const observer = {
      beforeProcess(record: any) {
        log.push(`processing ${record.readAttribute("name")}`);
      },
    };
    class Job extends Model {
      static {
        this.attribute("name", "string");
        this.defineModelCallbacks("process");
        (this as any).beforeProcess(observer);
      }
    }
    const j = new Job({ name: "import" });
    j.runCallbacks("process", () => {
      log.push("executed");
    });
    expect(log).toEqual(["processing import", "executed"]);
  });
});

describe("CallbackChain.run", () => {
  it("runs after callbacks only after the block completes", () => {
    const chain = new CallbackChain();
    const log: string[] = [];
    chain.register("after", "save", () => {
      log.push("after");
    });
    chain.runCallbacks("save", {}, () => {
      log.push("block:start");
      log.push("block:end");
    });
    expect(log).toEqual(["block:start", "block:end", "after"]);
  });

  it("returns false and skips block when before callback halts", () => {
    const chain = new CallbackChain();
    const log: string[] = [];
    chain.register("before", "save", () => {
      log.push("before");
      return false;
    });
    chain.register("after", "save", () => {
      log.push("after");
    });
    const result = chain.runCallbacks("save", {}, () => {
      log.push("block");
    });
    expect(result).toBe(false);
    expect(log).toEqual(["before"]);
  });

  it("around callbacks wrap the block", () => {
    const chain = new CallbackChain();
    const log: string[] = [];
    chain.register("around", "save", (_record: any, proceed: () => void) => {
      log.push("around:before");
      proceed();
      log.push("around:after");
    });
    chain.register("after", "save", () => {
      log.push("after");
    });
    chain.runCallbacks("save", {}, () => {
      log.push("block");
    });
    expect(log).toEqual(["around:before", "block", "around:after", "after"]);
  });

  it("before callback that returns false halts the chain", () => {
    const chain = new CallbackChain();
    const log: string[] = [];
    chain.register("before", "save", () => {
      log.push("before");
      return false;
    });
    chain.register("after", "save", () => {
      log.push("after");
    });
    const result = chain.runCallbacks("save", {}, () => {
      log.push("block");
    });
    expect(result).toBe(false);
    expect(log).toEqual(["before"]);
  });

  it("after callbacks run in registration order", () => {
    const chain = new CallbackChain();
    const log: string[] = [];
    chain.register("after", "save", () => {
      log.push("after1");
    });
    chain.register("after", "save", () => {
      log.push("after2");
    });
    chain.runCallbacks("save", {}, () => {
      log.push("block");
    });
    expect(log).toEqual(["block", "after1", "after2"]);
  });
});

describe("Generic Model.setCallback / skipCallback / resetCallbacks (Rails fidelity)", () => {
  // Rails `set_callback(name, type, filter, options)` /
  // `skip_callback(...)` / `reset_callbacks(name)` from
  // `ActiveSupport::Callbacks::ClassMethods`.
  it("setCallback registers a function for arbitrary event + timing", () => {
    const log: string[] = [];
    class Thing extends Model {}
    Thing.setCallback("save", "before", () => log.push("before"));
    Thing.setCallback("save", "after", () => log.push("after"));
    new Thing().runCallbacks("save", () => log.push("block"));
    expect(log).toEqual(["before", "block", "after"]);
  });

  it("skipCallback removes a previously registered callback by reference", () => {
    const log: string[] = [];
    class Thing extends Model {}
    const cb = () => log.push("skipped-callback");
    Thing.setCallback("save", "before", cb);
    Thing.setCallback("save", "before", () => log.push("kept"));

    expect(Thing.skipCallback("save", "before", cb)).toBe(true);
    new Thing().runCallbacks("save", () => log.push("block"));
    expect(log).toEqual(["kept", "block"]);
  });

  it("skipCallback returns false on miss (Rails raises unless :raise => false)", () => {
    class Thing extends Model {}
    expect(Thing.skipCallback("save", "before", () => undefined)).toBe(false);
  });

  it("resetCallbacks clears all callbacks for an event", () => {
    const log: string[] = [];
    class Thing extends Model {}
    Thing.setCallback("save", "before", () => log.push("before"));
    Thing.setCallback("save", "after", () => log.push("after"));
    Thing.setCallback("update", "before", () => log.push("update-before"));

    Thing.resetCallbacks("save");
    new Thing().runCallbacks("save", () => log.push("save-block"));
    new Thing().runCallbacks("update", () => log.push("update-block"));
    expect(log).toEqual(["save-block", "update-before", "update-block"]);
  });

  it("setCallback on subclass does not leak up to parent (copy-on-first-write)", () => {
    const log: string[] = [];
    class Parent extends Model {}
    class Child extends Parent {}
    Child.setCallback("save", "before", () => log.push("child"));
    new Parent().runCallbacks("save", () => log.push("parent-block"));
    expect(log).toEqual(["parent-block"]);
    new Child().runCallbacks("save", () => log.push("child-block"));
    expect(log).toEqual(["parent-block", "child", "child-block"]);
  });

  it("setCallback respects prepend: true (runs before earlier-registered)", () => {
    const log: string[] = [];
    class Thing extends Model {}
    Thing.setCallback("save", "before", () => log.push("registered-first"));
    Thing.setCallback("save", "before", () => log.push("prepended"), { prepend: true });
    new Thing().runCallbacks("save", () => log.push("block"));
    expect(log).toEqual(["prepended", "registered-first", "block"]);
  });
});
