import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { Railtie as BaseRailtie, deprecator } from "@blazetrails/activesupport";
import { Digest } from "@blazetrails/activesupport/digest";
import { Trailtie, type TrailtieConfig } from "./active-support.js";

const { deprecators } = BaseRailtie;

describe("RailtieTest", () => {
  let savedSubclasses: (typeof BaseRailtie)[];
  let savedConfig: Record<string, unknown>;
  let savedHashDigestClass: typeof Digest.hashDigestClass;

  beforeEach(() => {
    savedSubclasses = [...BaseRailtie.subclasses];
    savedHashDigestClass = Digest.hashDigestClass;
    try {
      savedConfig =
        typeof structuredClone === "function"
          ? structuredClone(Trailtie.config)
          : { ...Trailtie.config };
    } catch {
      savedConfig = { ...Trailtie.config };
    }
  });

  afterEach(() => {
    (BaseRailtie.subclasses as (typeof BaseRailtie)[]).length = 0;
    (BaseRailtie.subclasses as (typeof BaseRailtie)[]).push(...savedSubclasses);
    for (const key of Object.keys(Trailtie.config)) {
      delete (Trailtie.config as Record<string, unknown>)[key];
    }
    Object.assign(Trailtie.config, savedConfig);
    for (const key of Object.keys(deprecators)) {
      delete deprecators[key];
    }
    Digest.hashDigestClass = savedHashDigestClass;
  });

  it("ActiveSupport::Railtie is registered in the global subclasses list", () => {
    expect(BaseRailtie.subclasses).toContain(Trailtie);
  });

  it("seeds config.activeSupport on load", () => {
    expect((Trailtie.config as TrailtieConfig).activeSupport).toBeDefined();
  });

  it("runInitializers registers the ActiveSupport deprecator", () => {
    Trailtie.runInitializers();
    expect(deprecators["activeSupport"]).toBe(deprecator);
  });

  it("runInitializers applies hashDigestClass from Railtie.config.activeSupport", () => {
    const custom = { hexdigest: (data: string): string => `custom:${data}` };
    (Trailtie.config as TrailtieConfig).activeSupport = { hashDigestClass: custom };
    Trailtie.runInitializers();
    expect(Digest.hashDigestClass).toBe(custom);
  });

  it("runInitializers leaves hashDigestClass untouched when config is absent", () => {
    const before = Digest.hashDigestClass;
    Trailtie.runInitializers();
    expect(Digest.hashDigestClass).toBe(before);
  });
});
