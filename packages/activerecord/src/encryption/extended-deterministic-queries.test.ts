import { describe, it, expect } from "vitest";
import {
  AdditionalValue,
  CoreQueries,
  EncryptedQuery,
  RelationQueries,
} from "./extended-deterministic-queries.js";
import { EncryptedAttributeType } from "./encrypted-attribute-type.js";

function fakeType(
  opts: { deterministic?: boolean; previousTypes?: EncryptedAttributeType[] } = {},
) {
  const t = Object.create(EncryptedAttributeType.prototype) as EncryptedAttributeType;
  Object.defineProperty(t, "deterministic", { value: opts.deterministic ?? true });
  Object.defineProperty(t, "previousTypes", { value: opts.previousTypes ?? [] });
  Object.defineProperty(t, "supportUnencryptedData", { value: false });
  (t as any).serialize = (v: unknown) => v;
  return t;
}

function fakeModel(attrs: Record<string, EncryptedAttributeType>) {
  return {
    _encryptedAttributes: new Set(Object.keys(attrs)),
    _attributeDefinitions: new Map(Object.entries(attrs).map(([n, type]) => [n, { type }])),
  };
}

function fakeRelation(model: any, whereHash: Record<string, unknown> = {}) {
  return {
    model,
    whereValuesHash: () => whereHash,
  };
}

describe("ActiveRecord::Encryption::ExtendedDeterministicQueriesTest", () => {
  it.skip("Finds records when data is unencrypted", () => {});
  it.skip("Finds records when data is encrypted", () => {});
  it.skip("Works well with downcased attributes", () => {});
  it.skip("Works well with string attribute names", () => {});
  it.skip("find_or_create_by works", () => {});
  it.skip("does not mutate arguments", () => {});
  it.skip("where(...).first_or_create works", () => {});
  it.skip("exists?(...) works", () => {});
  it.skip("If support_unencrypted_data is opted out at the attribute level, cannot find unencrypted data", () => {});
  it.skip("If support_unencrypted_data is opted out at the attribute level, can find encrypted data", () => {});
  it.skip("If support_unencrypted_data is opted in at the attribute level, can find unencrypted data", () => {});
  it.skip("If support_unencrypted_data is opted in at the attribute level, can find encrypted data", () => {});

  describe("EncryptedQuery.processArguments", () => {
    it("returns args unchanged when model has no deterministic encrypted attributes", () => {
      const model = fakeModel({ email: fakeType({ deterministic: false }) });
      const args = [{ email: "a@b" }];
      expect(EncryptedQuery.processArguments(model, args, true)).toBe(args);
    });

    it("returns args unchanged when attribute has no previous types", () => {
      const model = fakeModel({ email: fakeType({ previousTypes: [] }) });
      const args = [{ email: "a@b" }];
      expect(EncryptedQuery.processArguments(model, args, true)).toBe(args);
    });

    it("expands plaintext into [current, previous] AdditionalValue list", () => {
      const prev = fakeType();
      const model = fakeModel({ email: fakeType({ previousTypes: [prev] }) });
      const args = [{ email: "a@b" }];
      const [out] = EncryptedQuery.processArguments(model, args, true) as [
        Record<string, unknown[]>,
      ];
      expect(out.email).toHaveLength(2);
      expect(out.email[0]).toBeInstanceOf(AdditionalValue);
      expect(out.email[1]).toBeInstanceOf(AdditionalValue);
    });

    it("unwraps a Relation via its .model getter", () => {
      const prev = fakeType();
      const model = fakeModel({ email: fakeType({ previousTypes: [prev] }) });
      const relation = fakeRelation(model);
      const [out] = EncryptedQuery.processArguments(relation, [{ email: "x" }], true) as [
        Record<string, unknown[]>,
      ];
      expect(out.email).toHaveLength(2);
    });
  });

  describe("RelationQueries.scopeForCreate", () => {
    it("returns original scope when no encrypted attributes", () => {
      const rel = fakeRelation({
        _encryptedAttributes: new Set<string>(),
        _attributeDefinitions: new Map(),
      });
      const original = () => ({ foo: "bar" });
      expect(RelationQueries.scopeForCreate(original, rel)).toEqual({ foo: "bar" });
    });

    it("strips AdditionalValue trailers to the plaintext for deterministic attrs", () => {
      const type = fakeType();
      const model = fakeModel({ email: type });
      const rel = fakeRelation(model, {
        email: ["plain@x", new AdditionalValue("plain@x", type)],
      });
      const original = () => ({ other: "untouched" });
      const out = RelationQueries.scopeForCreate(original, rel);
      expect(out).toEqual({ other: "untouched", email: "plain@x" });
    });

    it("accepts single-element arrays (Rails: values[1..].all? on [] is true)", () => {
      const type = fakeType();
      const model = fakeModel({ email: type });
      const rel = fakeRelation(model, { email: ["only"] });
      const out = RelationQueries.scopeForCreate(() => ({}), rel);
      expect(out).toEqual({ email: "only" });
    });

    it("ignores entries whose trailers are not all AdditionalValue", () => {
      const type = fakeType();
      const model = fakeModel({ email: type });
      const rel = fakeRelation(model, { email: ["plain@x", "not-additional"] });
      const out = RelationQueries.scopeForCreate(() => ({}), rel);
      expect(out).toEqual({});
    });

    it("ignores non-deterministic encrypted attributes", () => {
      const type = fakeType({ deterministic: false });
      const model = fakeModel({ secret: type });
      const rel = fakeRelation(model, {
        secret: ["plain", new AdditionalValue("plain", type)],
      });
      const out = RelationQueries.scopeForCreate(() => ({ keep: 1 }), rel);
      expect(out).toEqual({ keep: 1 });
    });
  });

  describe("RelationQueries.where / isExists", () => {
    it("forwards processed args to the original where", () => {
      const prev = fakeType();
      const model = fakeModel({ email: fakeType({ previousTypes: [prev] }) });
      const rel = fakeRelation(model);
      let received: unknown[] = [];
      const original = function (this: unknown, ...a: unknown[]) {
        received = a;
        return "result";
      };
      const ret = RelationQueries.where(original, rel, [{ email: "x" }]);
      expect(ret).toBe("result");
      expect((received[0] as any).email).toHaveLength(2);
    });

    it("forwards processed args to the original exists?", () => {
      const prev = fakeType();
      const model = fakeModel({ email: fakeType({ previousTypes: [prev] }) });
      const rel = fakeRelation(model);
      let received: unknown[] = [];
      const original = function (this: unknown, ...a: unknown[]) {
        received = a;
        return true;
      };
      RelationQueries.isExists(original, rel, [{ email: "x" }]);
      expect((received[0] as any).email).toHaveLength(2);
    });
  });

  describe("CoreQueries.findBy", () => {
    it("forwards processed args to the original findBy (checkForAdditionalValues=false)", () => {
      const prev = fakeType();
      const klass = fakeModel({ email: fakeType({ previousTypes: [prev] }) });
      let received: unknown[] = [];
      const original = function (this: unknown, ...a: unknown[]) {
        received = a;
        return "rec";
      };
      CoreQueries.findBy(original, klass, [{ email: "x" }]);
      expect((received[0] as any).email).toHaveLength(2);
    });
  });
});
