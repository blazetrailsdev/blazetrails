import { describe, it, expect } from "vitest";
import { SANDBOX_GLOBALS_DTS } from "./sandbox-globals.d.ts.js";

describe("Sandbox globals type declarations", () => {
  it("exports a non-empty string", () => {
    expect(typeof SANDBOX_GLOBALS_DTS).toBe("string");
    expect(SANDBOX_GLOBALS_DTS.length).toBeGreaterThan(100);
  });

  // --- Core classes ---

  it("declares Base class", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("declare class Base");
    expect(SANDBOX_GLOBALS_DTS).toContain("static tableName");
    expect(SANDBOX_GLOBALS_DTS).toContain("static attribute");
    expect(SANDBOX_GLOBALS_DTS).toContain("static hasMany");
    expect(SANDBOX_GLOBALS_DTS).toContain("static belongsTo");
  });

  it("declares Migration class with schema methods", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("declare class Migration");
    expect(SANDBOX_GLOBALS_DTS).toContain("createTable");
    expect(SANDBOX_GLOBALS_DTS).toContain("dropTable");
    expect(SANDBOX_GLOBALS_DTS).toContain("addColumn");
    expect(SANDBOX_GLOBALS_DTS).toContain("removeColumn");
    expect(SANDBOX_GLOBALS_DTS).toContain("addIndex");
  });

  it("declares TableDefinition with column types", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("interface TableDefinition");
    expect(SANDBOX_GLOBALS_DTS).toContain("string(name: string)");
    expect(SANDBOX_GLOBALS_DTS).toContain("integer(name: string)");
    expect(SANDBOX_GLOBALS_DTS).toContain("text(name: string)");
    expect(SANDBOX_GLOBALS_DTS).toContain("boolean(name: string)");
    expect(SANDBOX_GLOBALS_DTS).toContain("timestamps()");
    expect(SANDBOX_GLOBALS_DTS).toContain("references(");
  });

  it("declares Schema.define", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("declare const Schema");
    expect(SANDBOX_GLOBALS_DTS).toContain("define(adapter");
  });

  // --- ActionController ---

  it("declares ActionController.Base", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("declare namespace ActionController");
    expect(SANDBOX_GLOBALS_DTS).toContain("class Base");
    expect(SANDBOX_GLOBALS_DTS).toContain("params:");
    expect(SANDBOX_GLOBALS_DTS).toContain("render(");
    expect(SANDBOX_GLOBALS_DTS).toContain("redirectTo(");
  });

  // --- Adapter ---

  it("declares adapter with all methods", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("declare const adapter");
    expect(SANDBOX_GLOBALS_DTS).toContain("execute(sql: string");
    expect(SANDBOX_GLOBALS_DTS).toContain("executeMutation(sql: string");
    expect(SANDBOX_GLOBALS_DTS).toContain("execRaw(sql: string");
    expect(SANDBOX_GLOBALS_DTS).toContain("getTables()");
    expect(SANDBOX_GLOBALS_DTS).toContain("getColumns(");
    expect(SANDBOX_GLOBALS_DTS).toContain("beginTransaction()");
    expect(SANDBOX_GLOBALS_DTS).toContain("commit()");
    expect(SANDBOX_GLOBALS_DTS).toContain("rollback()");
  });

  // --- CLI / App ---

  it("declares exec function", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain(
      "declare function exec(command: string): Promise<CliResult>",
    );
  });

  it("declares request function", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain(
      "declare function request(method: string, path: string): Promise<AppResponse>",
    );
  });

  it("declares app with routes and controllers", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("declare const app");
    expect(SANDBOX_GLOBALS_DTS).toContain("registerController(");
    expect(SANDBOX_GLOBALS_DTS).toContain("drawRoutes(");
    expect(SANDBOX_GLOBALS_DTS).toContain("resources(name: string)");
  });

  it("declares app.drawRoutes with HTTP verb methods", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("get(path: string");
    expect(SANDBOX_GLOBALS_DTS).toContain("post(path: string");
    expect(SANDBOX_GLOBALS_DTS).toContain("put(path: string");
    expect(SANDBOX_GLOBALS_DTS).toContain("delete(path: string");
  });

  // --- Runtime ---

  it("declares runtime with VFS", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("declare const runtime");
    expect(SANDBOX_GLOBALS_DTS).toContain("vfs:");
    expect(SANDBOX_GLOBALS_DTS).toContain("list()");
    expect(SANDBOX_GLOBALS_DTS).toContain("read(path: string)");
    expect(SANDBOX_GLOBALS_DTS).toContain("write(path: string");
  });

  it("declares runtime with database tasks", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("dbMigrate()");
    expect(SANDBOX_GLOBALS_DTS).toContain("dbRollback(");
    expect(SANDBOX_GLOBALS_DTS).toContain("dbSetup()");
    expect(SANDBOX_GLOBALS_DTS).toContain("dbReset()");
    expect(SANDBOX_GLOBALS_DTS).toContain("dbDrop()");
    expect(SANDBOX_GLOBALS_DTS).toContain("dbSchema()");
    expect(SANDBOX_GLOBALS_DTS).toContain("dbSeed(");
  });

  it("declares runtime with export/import", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("exportDB(): Uint8Array");
    expect(SANDBOX_GLOBALS_DTS).toContain("loadDB(data: Uint8Array)");
    expect(SANDBOX_GLOBALS_DTS).toContain("newProject()");
    expect(SANDBOX_GLOBALS_DTS).toContain("reset()");
  });

  // --- Return types ---

  it("declares CliResult interface", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("interface CliResult");
    expect(SANDBOX_GLOBALS_DTS).toContain("success: boolean");
    expect(SANDBOX_GLOBALS_DTS).toContain("output: string[]");
    expect(SANDBOX_GLOBALS_DTS).toContain("exitCode: number");
  });

  it("declares AppResponse interface", () => {
    expect(SANDBOX_GLOBALS_DTS).toContain("interface AppResponse");
    expect(SANDBOX_GLOBALS_DTS).toContain("status: number");
    expect(SANDBOX_GLOBALS_DTS).toContain("headers: Record<string, string>");
    expect(SANDBOX_GLOBALS_DTS).toContain("body: string");
  });
});
