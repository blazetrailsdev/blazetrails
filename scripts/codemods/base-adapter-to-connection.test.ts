import { describe, it, expect } from "vitest";
import {
  analyzeSources,
  applyRenames,
  globToRegExp,
  type FileReport,
} from "./base-adapter-to-connection.js";

/**
 * A minimal stand-in for `ActiveRecord::Base`: the deprecated `adapter`
 * accessor (get + set) that the codemod keys off, plus a `connection`
 * getter so rewritten sites still type-check in the fixture program.
 * Inlined into each fixture so symbol resolution stays single-file and does
 * not depend on cross-file module resolution.
 */
const BASE = `
  class DatabaseAdapter { execute(_sql: string): void {} }
  class Base {
    static _adapter: DatabaseAdapter | null = null;
    static get adapter(): DatabaseAdapter { return this.connection; }
    static set adapter(a: DatabaseAdapter) { this._adapter = a; }
    static get connection(): DatabaseAdapter { return this._adapter!; }
  }
`;

function analyze(src: string): FileReport {
  return analyzeSources({ "fixture.ts": BASE + src })[0];
}

describe("base-adapter-to-connection codemod", () => {
  it("rewrites this.adapter inside a Base subclass static method", () => {
    const src = `
      class Topic extends Base {
        static create() { return this.adapter.execute("select 1"); }
      }
    `;
    const report = analyze(src);
    expect(report.rename).toBe(1);
    expect(report.skip).toBe(0);
    const out = applyRenames(BASE + src, report.sites);
    expect(out).toContain("this.connection.execute");
    expect(out).not.toContain("this.adapter");
  });

  it("rewrites Base.adapter static member access", () => {
    const src = `function go() { return Base.adapter.execute("x"); }`;
    const report = analyze(src);
    expect(report.rename).toBe(1);
    expect(applyRenames(BASE + src, report.sites)).toContain("Base.connection.execute");
  });

  it("does NOT rewrite an unrelated class with an adapter field", () => {
    const src = `
      class Unrelated {
        adapter: string = "x";
        foo() { return this.adapter; }
      }
    `;
    const report = analyze(src);
    expect(report.rename).toBe(0);
    expect(report.skip).toBe(1);
    expect(report.sites[0].reason).toBe("LHS not Base");
  });

  it("does NOT rewrite someObject.adapter where LHS is a plain object type", () => {
    const src = `
      function go(someAdapter: { adapter: DatabaseAdapter }) {
        return someAdapter.adapter;
      }
    `;
    const report = analyze(src);
    expect(report.rename).toBe(0);
    expect(report.skip).toBe(1);
  });

  it("does NOT touch `adapter` used as a parameter or variable name", () => {
    const src = `
      function go(adapter: string) {
        const adapter2 = adapter;
        return adapter2.length;
      }
    `;
    const report = analyze(src);
    expect(report.total).toBe(0);
  });

  it("skips assignment targets (Base.adapter = x) — needs establishConnection", () => {
    const src = `function go(a: DatabaseAdapter) { Base.adapter = a; }`;
    const report = analyze(src);
    expect(report.rename).toBe(0);
    expect(report.skip).toBe(1);
    expect(report.sites[0].reason).toContain("assignment");
  });

  it("globToRegExp matches --exclude patterns against full paths", () => {
    expect(globToRegExp("*.test.ts").test("/repo/src/foo.test.ts")).toBe(true);
    expect(globToRegExp("*.test.ts").test("/repo/src/foo.ts")).toBe(false);
    expect(globToRegExp("**/adapters/**").test("/repo/src/adapters/pg.ts")).toBe(true);
    expect(globToRegExp("**/adapters/**").test("/repo/src/models/user.ts")).toBe(false);
  });

  it("is idempotent: a rewritten file has zero rename sites on a second pass", () => {
    const src = `
      class Topic extends Base {
        static create() { return this.adapter.execute("select 1"); }
      }
    `;
    const first = analyze(src);
    const rewritten = applyRenames(BASE + src, first.sites);
    const second = analyzeSources({ "fixture.ts": rewritten })[0];
    expect(second.rename).toBe(0);
  });
});
