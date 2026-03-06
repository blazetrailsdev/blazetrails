import { describe, it, expect, vi } from "vitest";
import {
  defineCallbacks,
  setCallback,
  skipCallback,
  resetCallbacks,
  runCallbacks,
} from "./callbacks.js";

describe("Callbacks", () => {
  describe("defineCallbacks / setCallback / runCallbacks", () => {
    it("runs before callbacks in order", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", (t) => {
        t.log.push("before1");
      });
      setCallback(target, "save", "before", (t) => {
        t.log.push("before2");
      });

      runCallbacks(target, "save", () => {
        target.log.push("block");
      });

      expect(target.log).toEqual(["before1", "before2", "block"]);
    });

    it("runs after callbacks in reverse order", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "after", (t) => {
        t.log.push("after1");
      });
      setCallback(target, "save", "after", (t) => {
        t.log.push("after2");
      });

      runCallbacks(target, "save", () => {
        target.log.push("block");
      });

      expect(target.log).toEqual(["block", "after2", "after1"]);
    });

    it("runs around callbacks wrapping the block", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "around", (t, next) => {
        t.log.push("around-before");
        next();
        t.log.push("around-after");
      });

      runCallbacks(target, "save", () => {
        target.log.push("block");
      });

      expect(target.log).toEqual(["around-before", "block", "around-after"]);
    });

    it("runs before, around, and after in correct order", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", (t) => t.log.push("before"));
      setCallback(target, "save", "around", (t, next) => {
        t.log.push("around-pre");
        next();
        t.log.push("around-post");
      });
      setCallback(target, "save", "after", (t) => t.log.push("after"));

      runCallbacks(target, "save", () => target.log.push("block"));

      expect(target.log).toEqual([
        "before",
        "around-pre",
        "block",
        "around-post",
        "after",
      ]);
    });
  });

  describe("halting", () => {
    it("halts when before callback returns false", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", () => false);
      setCallback(target, "save", "before", (t) => {
        t.log.push("should-not-run");
      });

      const result = runCallbacks(target, "save", () => {
        target.log.push("block");
      });

      expect(result).toBe(false);
      expect(target.log).toEqual([]);
    });

    it("does not halt when terminator is disabled", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save", { terminator: false });
      setCallback(target, "save", "before", () => false);

      const result = runCallbacks(target, "save", () => {
        target.log.push("block");
      });

      expect(result).toBe(true);
      expect(target.log).toEqual(["block"]);
    });

    it("around callback can halt by not calling next", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "around", (t) => {
        t.log.push("halted");
        // not calling next
      });

      runCallbacks(target, "save", () => {
        target.log.push("block");
      });

      expect(target.log).toEqual(["halted"]);
    });
  });

  describe("conditional callbacks", () => {
    it("respects :if condition", () => {
      const target = { log: [] as string[], shouldRun: false };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", (t) => t.log.push("conditional"), {
        if: (t) => t.shouldRun,
      });

      runCallbacks(target, "save");
      expect(target.log).toEqual([]);

      target.shouldRun = true;
      runCallbacks(target, "save");
      expect(target.log).toEqual(["conditional"]);
    });

    it("respects :unless condition", () => {
      const target = { log: [] as string[], skip: true };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", (t) => t.log.push("run"), {
        unless: (t) => t.skip,
      });

      runCallbacks(target, "save");
      expect(target.log).toEqual([]);

      target.skip = false;
      runCallbacks(target, "save");
      expect(target.log).toEqual(["run"]);
    });

    it("supports array of :if conditions", () => {
      const target = { log: [] as string[], a: true, b: false };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", (t) => t.log.push("run"), {
        if: [(t) => t.a, (t) => t.b],
      });

      runCallbacks(target, "save");
      expect(target.log).toEqual([]);

      target.b = true;
      runCallbacks(target, "save");
      expect(target.log).toEqual(["run"]);
    });
  });

  describe("prepend", () => {
    it("prepends callback to front of chain", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", (t) => t.log.push("first"));
      setCallback(target, "save", "before", (t) => t.log.push("prepended"), {
        prepend: true,
      });

      runCallbacks(target, "save");
      expect(target.log).toEqual(["prepended", "first"]);
    });
  });

  describe("skipCallback", () => {
    it("removes a specific callback", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      const cb = (t: any) => t.log.push("skipped");
      setCallback(target, "save", "before", cb);
      setCallback(target, "save", "before", (t) => t.log.push("kept"));

      skipCallback(target, "save", "before", cb);
      runCallbacks(target, "save");
      expect(target.log).toEqual(["kept"]);
    });
  });

  describe("resetCallbacks", () => {
    it("removes all callbacks from a chain", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", (t) => t.log.push("a"));
      setCallback(target, "save", "after", (t) => t.log.push("b"));

      resetCallbacks(target, "save");
      runCallbacks(target, "save", () => target.log.push("block"));
      expect(target.log).toEqual(["block"]);
    });
  });

  describe("error handling", () => {
    it("throws when setting callback on undefined chain", () => {
      const target = {};
      expect(() => setCallback(target, "save", "before", () => {})).toThrow(
        /No callback chain "save"/
      );
    });

    it("runs block when no chain is defined", () => {
      const target = {};
      const log: string[] = [];
      runCallbacks(target, "nonexistent", () => log.push("ran"));
      expect(log).toEqual(["ran"]);
    });
  });

  describe("no block", () => {
    it("works without a block", () => {
      const target = { log: [] as string[] };
      defineCallbacks(target, "save");
      setCallback(target, "save", "before", (t) => t.log.push("before"));
      setCallback(target, "save", "after", (t) => t.log.push("after"));

      runCallbacks(target, "save");
      expect(target.log).toEqual(["before", "after"]);
    });
  });
});
