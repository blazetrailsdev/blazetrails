import { describe, it, expect } from "vitest";
import { Table, InsertManager, UpdateManager, DeleteManager, SelectManager } from "./index.js";

describe("crud", () => {
  const users = new Table("users");

  describe("insert", () => {
    it("should call insert on the connection", () => {
      const mgr = new InsertManager(users);
      mgr.insert([[users.get("name"), "dean"]]);
      expect(mgr.toSql()).toContain('INSERT INTO "users"');
    });
  });

  describe("update", () => {
    it("should call update on the connection", () => {
      const mgr = new UpdateManager();
      mgr
        .table(users)
        .set([[users.get("name"), "sam"]])
        .where(users.get("id").eq(1));
      expect(mgr.toSql()).toContain('UPDATE "users"');
    });
  });

  describe("delete", () => {
    it("should call delete on the connection", () => {
      const mgr = new DeleteManager();
      mgr.from(users).where(users.get("id").eq(1));
      expect(mgr.toSql()).toContain('DELETE FROM "users"');
    });
  });

  describe("compileUpdate / compileDelete key assignment", () => {
    // Mirrors Rails Arel::Crud (activerecord/lib/arel/crud.rb): `um.key = key`
    // and `dm.key = key` are unconditional for Rails parity, so `null` is
    // assigned explicitly rather than being skipped. We spy on the setter
    // because the underlying statement initializes `key` to `null`, so a
    // post-hoc `manager.key === null` check would pass even with the prior
    // `if (key !== null)` guard in place.
    function spyKeySetter<T extends object>(
      proto: T,
    ): {
      calls: unknown[];
      restore: () => void;
    } {
      const original = Object.getOwnPropertyDescriptor(proto, "key")!;
      const calls: unknown[] = [];
      Object.defineProperty(proto, "key", {
        ...original,
        set(value: unknown) {
          calls.push(value);
          original.set!.call(this, value);
        },
      });
      return { calls, restore: () => Object.defineProperty(proto, "key", original) };
    }

    it("compileUpdate always assigns key, including null", () => {
      const spy = spyKeySetter(UpdateManager.prototype);
      try {
        const mgr = new SelectManager(users);
        mgr.compileUpdate([[users.get("id"), 1]], null);
        expect(spy.calls).toEqual([null]);
      } finally {
        spy.restore();
      }
    });

    it("compileDelete always assigns key, including null", () => {
      const spy = spyKeySetter(DeleteManager.prototype);
      try {
        const mgr = new SelectManager(users);
        mgr.compileDelete(null);
        expect(spy.calls).toEqual([null]);
      } finally {
        spy.restore();
      }
    });
  });
});
