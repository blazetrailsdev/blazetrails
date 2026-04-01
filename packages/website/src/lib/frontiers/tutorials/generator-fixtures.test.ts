import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { AppGenerator } from "@blazetrails/railties/generators/app-generator";
import { ModelGenerator } from "@blazetrails/railties/generators/model-generator";
import { fixtures } from "./generator-fixtures.js";

let tmpDir: string;
let output: string[];

function makeModelGen(cwd: string) {
  return new ModelGenerator({ cwd, output: (m) => output.push(m) });
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trails-fixtures-"));
  output = [];

  const appGen = new AppGenerator({ cwd: tmpDir, output: (m) => output.push(m) });
  await appGen.run("docs", { database: "sqlite", skipGit: true, skipInstall: true });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function appDir() {
  return path.join(tmpDir, "docs");
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(appDir(), relativePath), "utf-8");
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(appDir(), relativePath));
}

describe("generator fixtures", () => {
  describe("new docs", () => {
    it("creates expected app structure", () => {
      expect(fileExists("package.json")).toBe(true);
      expect(fileExists("tsconfig.json")).toBe(true);
      expect(fileExists("src/config/application.ts")).toBe(true);
      expect(fileExists("src/config/routes.ts")).toBe(true);
      expect(fileExists("src/config/database.ts")).toBe(true);
      expect(fileExists("src/app/models/application-record.ts")).toBe(true);
      expect(fileExists("src/app/controllers/application-controller.ts")).toBe(true);
      expect(fileExists("db/migrations/.gitkeep")).toBe(true);
      expect(fileExists("db/seeds.ts")).toBe(true);
    });

    it("package.json has correct name", () => {
      const pkg = JSON.parse(readFile("package.json"));
      expect(pkg.name).toBe("docs");
    });
  });

  describe("generate model User name:string email:string", () => {
    let files: string[];

    beforeAll(() => {
      output = [];
      const gen = makeModelGen(appDir());
      files = gen.run("User", ["name:string", "email:string"]);
    });

    it("creates model file", () => {
      expect(files).toContain("src/app/models/user.ts");
      const content = readFile("src/app/models/user.ts");
      expect(content).toContain("class User extends Base");
      expect(content).toContain('this.attribute("name", "string")');
      expect(content).toContain('this.attribute("email", "string")');
    });

    it("creates migration file", () => {
      const migFile = files.find((f) => f.startsWith("db/migrations/"));
      expect(migFile).toBeDefined();
      const content = readFile(migFile!);
      expect(content).toContain("class CreateUsers extends Migration");
      expect(content).toContain('t.string("name")');
      expect(content).toContain('t.string("email")');
      expect(content).toContain("t.timestamps()");
    });

    it("creates test file", () => {
      expect(files).toContain("test/models/user.test.ts");
    });
  });

  describe("generate model Folder name:string user_id:integer parent_id:integer", () => {
    let files: string[];

    beforeAll(() => {
      output = [];
      const gen = makeModelGen(appDir());
      files = gen.run("Folder", ["name:string", "user_id:integer", "parent_id:integer"]);
    });

    it("creates model file", () => {
      expect(files).toContain("src/app/models/folder.ts");
      const content = readFile("src/app/models/folder.ts");
      expect(content).toContain("class Folder extends Base");
      expect(content).toContain('this.attribute("name", "string")');
      expect(content).toContain('this.attribute("user_id", "integer")');
      expect(content).toContain('this.attribute("parent_id", "integer")');
    });

    it("creates migration with correct columns", () => {
      const migFile = files.find((f) => f.startsWith("db/migrations/"));
      expect(migFile).toBeDefined();
      const content = readFile(migFile!);
      expect(content).toContain("class CreateFolders extends Migration");
      expect(content).toContain('t.string("name")');
      expect(content).toContain('t.integer("user_id")');
      expect(content).toContain('t.integer("parent_id")');
    });
  });

  describe("generate model Document title:string body:text user_id:integer folder_id:integer", () => {
    let files: string[];

    beforeAll(() => {
      output = [];
      const gen = makeModelGen(appDir());
      files = gen.run("Document", [
        "title:string",
        "body:text",
        "user_id:integer",
        "folder_id:integer",
      ]);
    });

    it("creates model file", () => {
      expect(files).toContain("src/app/models/document.ts");
      const content = readFile("src/app/models/document.ts");
      expect(content).toContain("class Document extends Base");
      expect(content).toContain('this.attribute("title", "string")');
      expect(content).toContain('this.attribute("body", "text")');
      expect(content).toContain('this.attribute("user_id", "integer")');
      expect(content).toContain('this.attribute("folder_id", "integer")');
    });

    it("creates migration with correct columns", () => {
      const migFile = files.find((f) => f.startsWith("db/migrations/"));
      expect(migFile).toBeDefined();
      const content = readFile(migFile!);
      expect(content).toContain("class CreateDocuments extends Migration");
      expect(content).toContain('t.string("title")');
      expect(content).toContain('t.text("body")');
      expect(content).toContain('t.integer("user_id")');
      expect(content).toContain('t.integer("folder_id")');
    });
  });

  describe("Music tutorial generators", () => {
    let artistFiles: string[];
    let albumFiles: string[];
    let trackFiles: string[];
    let genreFiles: string[];

    beforeAll(() => {
      output = [];
      const gen = makeModelGen(appDir());
      artistFiles = gen.run("Artist", ["name:string", "bio:text"]);
      albumFiles = gen.run("Album", ["title:string", "artist_id:integer", "release_date:date"]);
      trackFiles = gen.run("Track", [
        "title:string",
        "album_id:integer",
        "track_number:integer",
        "duration:integer",
      ]);
      genreFiles = gen.run("Genre", ["name:string"]);
    });

    it("creates Artist model and migration", () => {
      expect(artistFiles).toContain("src/app/models/artist.ts");
      const content = readFile("src/app/models/artist.ts");
      expect(content).toContain("class Artist extends Base");
      expect(content).toContain('this.attribute("name", "string")');
      expect(content).toContain('this.attribute("bio", "text")');
    });

    it("creates Album model and migration", () => {
      expect(albumFiles).toContain("src/app/models/album.ts");
      const content = readFile("src/app/models/album.ts");
      expect(content).toContain("class Album extends Base");
      expect(content).toContain('this.attribute("artist_id", "integer")');
      expect(content).toContain('this.attribute("release_date", "date")');
    });

    it("creates Track model and migration", () => {
      expect(trackFiles).toContain("src/app/models/track.ts");
      const content = readFile("src/app/models/track.ts");
      expect(content).toContain("class Track extends Base");
      expect(content).toContain('this.attribute("track_number", "integer")');
      expect(content).toContain('this.attribute("duration", "integer")');
    });

    it("creates Genre model and migration", () => {
      expect(genreFiles).toContain("src/app/models/genre.ts");
      const content = readFile("src/app/models/genre.ts");
      expect(content).toContain("class Genre extends Base");
    });
  });

  describe("Finances tutorial generators", () => {
    let accountFiles: string[];
    let categoryFiles: string[];
    let transactionFiles: string[];
    let budgetFiles: string[];

    beforeAll(() => {
      output = [];
      const gen = makeModelGen(appDir());
      accountFiles = gen.run("Account", ["name:string", "balance:decimal"]);
      categoryFiles = gen.run("Category", ["name:string", "parent_id:integer"]);
      transactionFiles = gen.run("Transaction", [
        "description:string",
        "amount:decimal",
        "account_id:integer",
        "category_id:integer",
        "date:date",
      ]);
      budgetFiles = gen.run("Budget", [
        "category_id:integer",
        "amount:decimal",
        "period_start:date",
        "period_end:date",
      ]);
    });

    it("creates Account model and migration", () => {
      expect(accountFiles).toContain("src/app/models/account.ts");
      const content = readFile("src/app/models/account.ts");
      expect(content).toContain("class Account extends Base");
      expect(content).toContain('this.attribute("balance", "decimal")');
    });

    it("creates Category model with self-referential parent_id", () => {
      expect(categoryFiles).toContain("src/app/models/category.ts");
      const content = readFile("src/app/models/category.ts");
      expect(content).toContain("class Category extends Base");
      expect(content).toContain('this.attribute("parent_id", "integer")');
    });

    it("creates Transaction model and migration", () => {
      expect(transactionFiles).toContain("src/app/models/transaction.ts");
      const content = readFile("src/app/models/transaction.ts");
      expect(content).toContain("class Transaction extends Base");
      expect(content).toContain('this.attribute("amount", "decimal")');
      expect(content).toContain('this.attribute("account_id", "integer")');
      expect(content).toContain('this.attribute("category_id", "integer")');
    });

    it("creates Budget model and migration", () => {
      expect(budgetFiles).toContain("src/app/models/budget.ts");
      const content = readFile("src/app/models/budget.ts");
      expect(content).toContain("class Budget extends Base");
      expect(content).toContain('this.attribute("period_start", "date")');
      expect(content).toContain('this.attribute("period_end", "date")');
    });
  });
});

describe("exported fixtures", () => {
  it("has docs fixtures", () => {
    expect(fixtures.docs).toBeDefined();
    expect(fixtures.docs.length).toBeGreaterThan(0);
  });

  it("has music fixtures", () => {
    expect(fixtures.music).toBeDefined();
    expect(fixtures.music.length).toBeGreaterThan(0);
  });

  it("has finances fixtures", () => {
    expect(fixtures.finances).toBeDefined();
    expect(fixtures.finances.length).toBeGreaterThan(0);
  });

  it("each fixture has name, command, and expectedFiles", () => {
    const allFixtures = [...fixtures.docs, ...fixtures.music, ...fixtures.finances];
    for (const fixture of allFixtures) {
      expect(fixture.name).toBeTruthy();
      expect(fixture.command).toBeTruthy();
      expect(fixture.expectedFiles.length).toBeGreaterThan(0);
    }
  });
});
