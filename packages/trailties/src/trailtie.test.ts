// Mirrors railties/test/railties/railtie_test.rb. Block-runner and
// lifecycle-hook cases land alongside PR 2.1b.
import { describe, it, expect } from "vitest";
import { Trailtie } from "./trailtie.js";
import { Configuration } from "./trailtie/configuration.js";
import { sealAgainstInheritance } from "./trailtie/configurable.js";

describe("Trailtie", () => {
  it("cannot instantiate a Railtie object", () => {
    expect(() => new Trailtie()).toThrow(/abstract/);
  });

  it("Railtie provides railtie_name", () => {
    class MyTrailtie extends Trailtie {}
    Trailtie.register(MyTrailtie);
    expect(MyTrailtie.railtieName()).toBe("my_trailtie");
  });

  it("railtie_name can be set manually", () => {
    class OtherTrailtie extends Trailtie {}
    Trailtie.register(OtherTrailtie);
    OtherTrailtie.railtieName("custom_name");
    expect(OtherTrailtie.railtieName()).toBe("custom_name");
  });

  it("config is available to railtie", () => {
    class ConfigTrailtie extends Trailtie {}
    Trailtie.register(ConfigTrailtie);
    expect(ConfigTrailtie.config).toBeInstanceOf(Configuration);
    expect(ConfigTrailtie.config).toBe(ConfigTrailtie.config);
  });

  it("railtie can add to_prepare callbacks", () => {
    class PrepTrailtie extends Trailtie {}
    Trailtie.register(PrepTrailtie);
    const before = PrepTrailtie.config.toPrepareBlocks.length;
    const block = () => {};
    PrepTrailtie.config.toPrepare(block);
    expect(PrepTrailtie.config.toPrepareBlocks.length).toBe(before + 1);
    expect(PrepTrailtie.config.toPrepareBlocks).toContain(block);
  });

  it("railtie can add initializers", () => {
    const calls: string[] = [];
    class InitTrailtie extends Trailtie {}
    Trailtie.register(InitTrailtie);
    InitTrailtie.initializer("init.one", function () {
      calls.push("one");
    });
    InitTrailtie.instance().runInitializers();
    expect(calls).toEqual(["one"]);
  });

  it("rake_tasks block is executed when MyApp.load_tasks is called", () => {
    let ran = false;
    class TaskTie extends Trailtie {}
    Trailtie.register(TaskTie);
    TaskTie.rakeTasks(() => {
      ran = true;
    });
    expect(ran).toBe(false);
    TaskTie.instance().runTasksBlocks({});
    expect(ran).toBe(true);
  });

  it("rake_tasks block defined in superclass of railtie is also executed", () => {
    const ran: string[] = [];
    class ParentTie extends Trailtie {}
    Trailtie.register(ParentTie);
    ParentTie.rakeTasks(function () {
      ran.push(this.railtieName);
    });
    class ChildTie extends ParentTie {}
    Trailtie.register(ChildTie);
    ChildTie.railtieName("child_tie");
    ChildTie.instance().runTasksBlocks({});
    expect(ran).toContain("child_tie");
  });

  for (const kind of ["generators", "console", "server", "runner"] as const) {
    it(`${kind} block is executed when MyApp.load_${kind} is called`, () => {
      let ran = false;
      class T extends Trailtie {}
      Trailtie.register(T);
      T[kind](() => {
        ran = true;
      });
      const runner = {
        generators: "runGeneratorsBlocks",
        console: "runConsoleBlocks",
        server: "runServerBlocks",
        runner: "runRunnerBlocks",
      }[kind] as keyof Trailtie;
      (T.instance()[runner] as (a: unknown) => void).call(T.instance(), {});
      expect(ran).toBe(true);
    });
  }

  it("Configuration lifecycle hooks register and run", () => {
    const order: string[] = [];
    new Configuration().beforeInitialize(() => order.push("before"));
    new Configuration().afterInitialize(() => order.push("after"));
    Configuration.runHook("beforeInitialize");
    Configuration.runHook("afterInitialize");
    expect(order).toContain("before");
    expect(order).toContain("after");
  });

  it("Configurable seals a class against further subclassing", () => {
    class SealedTie extends Trailtie {}
    sealAgainstInheritance(SealedTie);
    class ShouldFail extends SealedTie {}
    expect(() => Trailtie.register(ShouldFail)).toThrow(/cannot inherit from a SealedTie/);
  });

  it("returns registered subclasses sorted by load order, excluding abstract entries", () => {
    class Early extends Trailtie {}
    Trailtie.register(Early);
    class Late extends Trailtie {}
    Trailtie.register(Late);
    const list = Trailtie.subclasses();
    expect(list.indexOf(Late)).toBeGreaterThan(list.indexOf(Early));
    expect(list.every((s) => !s.isAbstractRailtie())).toBe(true);
  });
});
