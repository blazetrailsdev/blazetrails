import { describe, expect, it } from "vitest";
import { MigrationProxy } from "./deprecator.js";

describe("MigrationProxy", () => {
  it("stores name, version, filename, scope", () => {
    const proxy = new MigrationProxy(
      "CreateUsers",
      "20240101000000",
      "/db/migrate/20240101000000_create_users.ts",
      "",
    );
    expect(proxy.name).toBe("CreateUsers");
    expect(proxy.version).toBe("20240101000000");
    expect(proxy.filename).toBe("/db/migrate/20240101000000_create_users.ts");
    expect(proxy.scope).toBe("");
  });

  it("basename returns the filename basename", () => {
    const proxy = new MigrationProxy(
      "CreateUsers",
      "1",
      "/db/migrate/20240101000000_create_users.ts",
      "",
    );
    expect(proxy.basename()).toBe("20240101000000_create_users.ts");
  });
});
