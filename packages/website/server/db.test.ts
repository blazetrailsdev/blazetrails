import { describe, it, expect } from "vitest";
import { createDatabase } from "./db.js";

describe("createDatabase", () => {
  it("creates all required tables", async () => {
    const db = createDatabase(":memory:");
    const tables = (
      await db.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
    ).map((r) => r.name);

    expect(tables).toContain("users");
    expect(tables).toContain("magic_links");
    expect(tables).toContain("sessions");
    expect(tables).toContain("projects");
  });

  it("creates indexes", async () => {
    const db = createDatabase(":memory:");
    const indexes = (
      await db.execute(
        `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`,
      )
    ).map((r) => r.name);

    expect(indexes).toContain("idx_projects_user_id");
    expect(indexes).toContain("idx_projects_updated_at");
    expect(indexes).toContain("idx_sessions_user_id");
    expect(indexes).toContain("idx_magic_links_email");
  });

  it("enforces unique email constraint on users", async () => {
    const db = createDatabase(":memory:");
    await db.executeMutation('INSERT INTO "users" ("id", "email") VALUES (?, ?)', ["1", "a@b.com"]);
    await expect(
      db.executeMutation('INSERT INTO "users" ("id", "email") VALUES (?, ?)', ["2", "a@b.com"]),
    ).rejects.toThrow();
  });
});
