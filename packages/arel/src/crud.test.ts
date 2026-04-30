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
    // and `dm.key = key` are unconditional, so a `null` key clears any prior
    // value rather than being skipped.
    it("compileUpdate always assigns key, including null", () => {
      const mgr = new SelectManager(users);
      const um = mgr.compileUpdate([[users.get("id"), 1]], null);
      expect(um.key).toBeNull();
    });

    it("compileDelete always assigns key, including null", () => {
      const mgr = new SelectManager(users);
      const dm = mgr.compileDelete(null);
      expect(dm.key).toBeNull();
    });
  });
});
