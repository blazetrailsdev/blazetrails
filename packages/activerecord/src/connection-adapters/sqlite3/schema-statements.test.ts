import { describe, it, expect, vi } from "vitest";
import { schemaCreation, createSchemaDumper, isVirtualTableExists } from "./schema-statements.js";
import { SchemaCreation } from "./schema-creation.js";
import { SchemaDumper } from "./schema-dumper.js";

describe("SQLite3::SchemaStatements", () => {
  describe("schemaCreation", () => {
    it("returns a SQLite3 SchemaCreation instance", () => {
      expect(schemaCreation()).toBeInstanceOf(SchemaCreation);
    });
  });

  describe("createSchemaDumper", () => {
    it("returns a SchemaDumper instance", () => {
      const fakeAdapter = { adapterName: "sqlite" } as any;
      const dumper = createSchemaDumper(fakeAdapter);
      expect(dumper).toBeInstanceOf(SchemaDumper);
    });
  });

  describe("isVirtualTableExists", () => {
    it("returns true when a matching virtual table row is found", async () => {
      const fakeAdapter = {
        execute: vi.fn().mockResolvedValue([{ name: "virtual_tab" }]),
      } as any;
      expect(await isVirtualTableExists(fakeAdapter, "virtual_tab")).toBe(true);
    });

    it("returns false when no matching row is found", async () => {
      const fakeAdapter = {
        execute: vi.fn().mockResolvedValue([]),
      } as any;
      expect(await isVirtualTableExists(fakeAdapter, "no_such_table")).toBe(false);
    });

    it("queries sqlite_temp_master for temp schema tables", async () => {
      const fakeAdapter = {
        execute: vi.fn().mockResolvedValue([]),
      } as any;
      await isVirtualTableExists(fakeAdapter, "temp.my_vtab");
      expect(fakeAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining("sqlite_temp_master"),
        expect.anything(),
      );
    });
  });
});
