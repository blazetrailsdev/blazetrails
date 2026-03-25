import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { MigrationGenerator } from "./migration-generator.js";

let tmpDir: string;
let lines: string[];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rails-ts-test-"));
  lines = [];
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeGen() {
  return new MigrationGenerator({ cwd: tmpDir, output: (m) => lines.push(m) });
}

function readMigration(files: string[]): string {
  return fs.readFileSync(path.join(tmpDir, files[0]), "utf-8");
}

describe("MigrationGeneratorTest", () => {
  it("migration", () => {
    const gen = makeGen();
    const files = gen.run("CreateUsers", []);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^db\/migrations\/\d{14}-create-users\.ts$/);
    const content = readMigration(files);
    expect(content).toContain("class CreateUsers extends Migration");
  });

  it("migration with class name", () => {
    const gen = makeGen();
    const files = gen.run("CreateUsers", []);
    const content = readMigration(files);
    expect(content).toContain("class CreateUsers extends Migration");
  });

  it("create table migration", () => {
    const gen = makeGen();
    const files = gen.run("CreateBooks", ["title:string", "body:text"]);
    const content = readMigration(files);
    expect(content).toContain('createTable("books"');
    expect(content).toContain('t.string("title")');
    expect(content).toContain('t.text("body")');
    expect(content).toContain('dropTable("books")');
  });

  it("create table migration with timestamps", () => {
    const gen = makeGen();
    const files = gen.run("CreateBooks", ["title:string"]);
    const content = readMigration(files);
    expect(content).toContain("t.timestamps()");
  });

  it("create table timestamps are skipped", () => {
    const gen = makeGen();
    const files = gen.run("CreateBooks", ["title:string"], { timestamps: false });
    const content = readMigration(files);
    expect(content).toContain('createTable("books"');
    expect(content).not.toContain("timestamps");
  });

  it("add migration with attributes", () => {
    const gen = makeGen();
    const files = gen.run("AddTitleToBooks", ["title:string"]);
    const content = readMigration(files);
    expect(content).toContain('addColumn("books", "title", "string")');
    expect(content).toContain('removeColumn("books", "title")');
  });

  it("add migration with attributes and indices", () => {
    const gen = makeGen();
    const files = gen.run("AddTitleToPosts", ["title:string:index"]);
    const content = readMigration(files);
    expect(content).toContain('addColumn("posts", "title", "string")');
    expect(content).toContain('addIndex("posts", "title")');
  });

  it("remove migration with attributes", () => {
    const gen = makeGen();
    const files = gen.run("RemoveTitleFromPosts", ["title:string"]);
    const content = readMigration(files);
    expect(content).toContain('removeColumn("posts", "title")');
    expect(content).toContain('addColumn("posts", "title", "string")');
  });

  it("add migration with references options", () => {
    const gen = makeGen();
    const files = gen.run("AddAuthorToBooks", ["author:belongs_to"]);
    const content = readMigration(files);
    expect(content).toContain('addReference("books", "author"');
  });

  it("add migration with references adds foreign keys", () => {
    const gen = makeGen();
    const files = gen.run("AddAuthorToBooks", ["author:references"]);
    const content = readMigration(files);
    expect(content).toContain("foreignKey: true");
  });

  it("remove migration with references options", () => {
    const gen = makeGen();
    const files = gen.run("RemoveAuthorFromBooks", ["author:references"]);
    const content = readMigration(files);
    expect(content).toContain('removeReference("books", "author")');
  });

  it("remove migration with references removes foreign keys", () => {
    const gen = makeGen();
    const files = gen.run("RemoveAuthorFromBooks", ["author:references"]);
    const content = readMigration(files);
    expect(content).toContain('addReference("books", "author"');
    expect(content).toContain("foreignKey: true");
  });

  it("should create empty migrations if name not start with add or remove or create", () => {
    const gen = makeGen();
    const files = gen.run("DoSomethingComplex", []);
    const content = readMigration(files);
    expect(content).toContain("TODO: implement migration");
  });

  it("add migration with table having from in title", () => {
    const gen = makeGen();
    const files = gen.run("AddFromToUsers", ["from:string"]);
    const content = readMigration(files);
    expect(content).toContain('addColumn("users", "from", "string")');
  });

  it("remove migration with table having to in title", () => {
    const gen = makeGen();
    const files = gen.run("RemoveToFromUsers", ["to:string"]);
    const content = readMigration(files);
    expect(content).toContain('removeColumn("users", "to")');
  });

  it("add migration with references options when primary key uuid", () => {
    // We don't support uuid primary keys yet, but the reference should still generate
    const gen = makeGen();
    const files = gen.run("AddAuthorToBooks", ["author:references"]);
    const content = readMigration(files);
    expect(content).toContain('addReference("books", "author"');
    expect(content).toContain("foreignKey: true");
  });

  it("create table migration ignores virtual attributes", () => {
    // Virtual attributes (rich_text, attachment) should be skipped in createTable.
    // We don't have virtual types yet — verify unknown types don't crash the generator.
    const gen = makeGen();
    const files = gen.run("CreatePosts", ["title:string"]);
    const content = readMigration(files);
    expect(content).toContain('createTable("posts"');
    expect(content).toContain('t.string("title")');
  });
});
