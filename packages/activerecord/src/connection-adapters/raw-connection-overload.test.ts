import { describe, it, expect } from "vitest";
import { ArgumentError } from "@blazetrails/activemodel";
import { AbstractAdapter } from "./abstract-adapter.js";
import { PostgreSQLAdapter } from "./postgresql-adapter.js";
import { Mysql2Adapter } from "./mysql2-adapter.js";
import { deprecator } from "../deprecator.js";

// A pre-opened raw driver connection is a class instance, not a plain config
// hash — mirrors Rails' `is_a?(Hash)` discriminator in
// `AbstractAdapter#initialize` (abstract_adapter.rb:141).
class FakeRawConnection {
  query(): void {}
}

function captureDeprecations<T>(fn: () => T): { result: T; messages: string[] } {
  const dep = deprecator();
  const previous = dep.behavior;
  const messages: string[] = [];
  dep.behavior = (message: unknown): void => {
    messages.push(String(message));
  };
  try {
    return { result: fn(), messages };
  } finally {
    dep.behavior = previous;
  }
}

describe("deprecated raw-connection initialize overload", () => {
  describe("AbstractAdapter._isDeprecatedRawConnectionArg", () => {
    const detect = (
      AbstractAdapter as unknown as { _isDeprecatedRawConnectionArg(arg: unknown): boolean }
    )._isDeprecatedRawConnectionArg;

    it("treats a pre-opened driver connection (class instance) as a raw connection", () => {
      expect(detect(new FakeRawConnection())).toBe(true);
    });

    it("does not treat a plain config hash as a raw connection", () => {
      expect(detect({ database: "blog" })).toBe(false);
      expect(detect(Object.create(null) as object)).toBe(false);
    });

    it("does not treat a connection string or array as a raw connection", () => {
      expect(detect("postgres://localhost/blog")).toBe(false);
      expect(detect(["postgres://localhost/blog"])).toBe(false);
      expect(detect(null)).toBe(false);
    });
  });

  describe("PostgreSQLAdapter", () => {
    it("constructs an adapter from the legacy raw-connection signature", () => {
      const raw = new FakeRawConnection();
      const { result: adapter } = captureDeprecations(() => new PostgreSQLAdapter(raw as never));
      expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
      expect(
        (adapter as unknown as { _unconfiguredConnection: unknown })._unconfiguredConnection,
      ).toBe(raw);
    });

    it("emits a deprecation warning for the legacy raw-connection signature", () => {
      const { messages } = captureDeprecations(
        () => new PostgreSQLAdapter(new FakeRawConnection() as never),
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(/pre-opened raw connection is.*deprecated/i);
    });

    it("does not warn for the modern connection-string signature", () => {
      const { messages } = captureDeprecations(
        () => new PostgreSQLAdapter("postgres://localhost/blog"),
      );
      expect(messages).toEqual([]);
    });

    it("does not warn for the modern config-hash signature", () => {
      const { messages } = captureDeprecations(() => new PostgreSQLAdapter({ database: "blog" }));
      expect(messages).toEqual([]);
    });

    it("honors prepared_statements from the deprecated config", () => {
      const { result: adapter } = captureDeprecations(
        () =>
          new PostgreSQLAdapter(new FakeRawConnection() as never, { preparedStatements: false }),
      );
      expect(adapter.preparedStatements).toBe(false);
    });

    it("raises ArgumentError when a config hash is passed with extra arguments", () => {
      expect(() => new PostgreSQLAdapter({ database: "blog" }, { database: "blog" })).toThrow(
        ArgumentError,
      );
    });

    it("normalizes a null deprecated config to an empty hash", () => {
      const { result: adapter } = captureDeprecations(
        () => new PostgreSQLAdapter(new FakeRawConnection() as never, null as never),
      );
      expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
    });
  });

  describe("Mysql2Adapter", () => {
    it("constructs an adapter from the legacy raw-connection signature", () => {
      const raw = new FakeRawConnection();
      const { result: adapter } = captureDeprecations(() => new Mysql2Adapter(raw as never));
      expect(adapter).toBeInstanceOf(Mysql2Adapter);
      expect(
        (adapter as unknown as { _unconfiguredConnection: unknown })._unconfiguredConnection,
      ).toBe(raw);
    });

    it("emits a deprecation warning for the legacy raw-connection signature", () => {
      const { messages } = captureDeprecations(
        () => new Mysql2Adapter(new FakeRawConnection() as never),
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(/pre-opened raw connection is.*deprecated/i);
    });

    it("does not warn for the modern connection-string signature", () => {
      const { messages } = captureDeprecations(() => new Mysql2Adapter("mysql2://localhost/blog"));
      expect(messages).toEqual([]);
    });

    it("does not warn for the modern config-hash signature", () => {
      const { messages } = captureDeprecations(
        () => new Mysql2Adapter({ database: "blog", _fakeConnection: true }),
      );
      expect(messages).toEqual([]);
    });

    it("honors prepared_statements from the deprecated config", () => {
      const { result: adapter } = captureDeprecations(
        () => new Mysql2Adapter(new FakeRawConnection() as never, { preparedStatements: false }),
      );
      expect(adapter.preparedStatements).toBe(false);
    });

    it("raises ArgumentError when a config hash is passed with extra arguments", () => {
      expect(
        () => new Mysql2Adapter({ database: "blog", _fakeConnection: true }, { database: "blog" }),
      ).toThrow(ArgumentError);
    });
  });
});
