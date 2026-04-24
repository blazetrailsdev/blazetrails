/**
 * Lint — compliance tests for ActiveModel-compatible objects.
 *
 * Mirrors: ActiveModel::Lint and ActiveModel::Lint::Tests
 *
 * In Rails, Lint::Tests is a module you include into your test class
 * to verify that an object complies with the ActiveModel interface.
 * Here we provide standalone assertion functions that do the same.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Lint {}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Tests {
  export function testToKey(model: { toKey(): unknown[] | null; isPersisted(): boolean }): void {
    const key = model.toKey();
    if (key !== null && !Array.isArray(key)) {
      throw new Error("toKey must return null or an array");
    }

    const persisted = model.isPersisted();
    if (typeof persisted !== "boolean") {
      throw new Error("isPersisted must return a boolean");
    }

    if (persisted && key === null) {
      throw new Error("toKey must not return null when the model is persisted");
    }
  }

  export function testToParam(model: {
    toParam(): string | null;
    toKey(): unknown[] | null;
  }): void {
    const param = model.toParam();
    if (param !== null && typeof param !== "string") {
      throw new Error("toParam must return null or a string");
    }
  }

  export function testToPartialPath(model: { toPartialPath(): string }): void {
    const path = model.toPartialPath();
    if (typeof path !== "string") {
      throw new Error("toPartialPath must return a string");
    }
  }

  export function testPersisted(model: { isPersisted(): boolean }): void {
    const result = model.isPersisted();
    if (typeof result !== "boolean") {
      throw new Error("isPersisted must return a boolean");
    }
  }

  export function testErrors(model: { errors: { fullMessages: unknown[] } }): void {
    const messages = model.errors.fullMessages;
    if (!Array.isArray(messages)) {
      throw new Error("errors.fullMessages must return an array");
    }
  }

  export function testModelNaming(model: {
    constructor: { modelName?: { human: string; singular: string; plural: string } };
  }): void {
    const modelName = model.constructor.modelName;
    if (!modelName) {
      throw new Error("model.constructor.modelName must be defined");
    }
    if (typeof modelName.human !== "string") {
      throw new Error("modelName.human must return a string");
    }
    if (typeof modelName.singular !== "string") {
      throw new Error("modelName.singular must return a string");
    }
    if (typeof modelName.plural !== "string") {
      throw new Error("modelName.plural must return a string");
    }
  }

  export function testErrorsAref(model: { errors: { get(attribute: string): string[] } }): void {
    const result = model.errors.get("attribute");
    if (!Array.isArray(result)) {
      throw new Error("errors.get(attribute) must return an array");
    }
  }
}

export const {
  testToKey,
  testToParam,
  testToPartialPath,
  testPersisted,
  testErrors,
  testModelNaming,
  testErrorsAref,
} = Tests;

/**
 * The Rails-canonical Lint::Tests as a name -> assertion list.
 *
 * Mirrors the discoverable `test_*` methods on `ActiveModel::Lint::Tests`,
 * allowing a test framework to enumerate and dispatch them — same role
 * as MiniTest's `include ActiveModel::Lint::Tests` (lint.rb).
 */
export const lintTests: ReadonlyArray<{ name: string; run(model: unknown): void }> = [
  { name: "to_key", run: (m) => Tests.testToKey(m as Parameters<typeof Tests.testToKey>[0]) },
  { name: "to_param", run: (m) => Tests.testToParam(m as Parameters<typeof Tests.testToParam>[0]) },
  {
    name: "to_partial_path",
    run: (m) => Tests.testToPartialPath(m as Parameters<typeof Tests.testToPartialPath>[0]),
  },
  {
    name: "persisted?",
    run: (m) => Tests.testPersisted(m as Parameters<typeof Tests.testPersisted>[0]),
  },
  {
    name: "model_naming",
    run: (m) => Tests.testModelNaming(m as Parameters<typeof Tests.testModelNaming>[0]),
  },
  {
    name: "errors_aref",
    run: (m) => Tests.testErrorsAref(m as Parameters<typeof Tests.testErrorsAref>[0]),
  },
  { name: "errors", run: (m) => Tests.testErrors(m as Parameters<typeof Tests.testErrors>[0]) },
];

interface MinimalDescribe {
  (label: string, body: () => void): void;
}
interface MinimalIt {
  (label: string, body: () => void): void;
}

/**
 * Vitest-friendly translation of Rails' `include ActiveModel::Lint::Tests`.
 * Pass in your testing framework's `describe`/`it` and a factory that
 * builds a fresh model for each assertion; emits one `it` per Rails
 * `test_*` method, mirroring how MiniTest discovers them.
 *
 * Example:
 *   import { describe, it } from "vitest";
 *   import { describeLint } from "@blazetrails/activemodel";
 *   describeLint({ describe, it }, () => new Post());
 */
export function describeLint(
  framework: { describe: MinimalDescribe; it: MinimalIt },
  buildModel: () => unknown,
  options: { label?: string } = {},
): void {
  const label = options.label ?? "ActiveModel::Lint";
  framework.describe(label, () => {
    for (const t of lintTests) {
      framework.it(t.name, () => t.run(buildModel()));
    }
  });
}
