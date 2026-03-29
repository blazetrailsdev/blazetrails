import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import { VirtualFS } from "./virtual-fs.js";

let adapter: SqlJsAdapter;
let vfs: VirtualFS;

beforeEach(async () => {
  const SQL = await initSqlJs();
  adapter = new SqlJsAdapter(new SQL.Database());
  vfs = new VirtualFS(adapter);
});

describe("VirtualFS", () => {
  describe("write and read", () => {
    it("writes and reads a file", () => {
      vfs.write("hello.ts", "console.log('hi')");
      const file = vfs.read("hello.ts");
      expect(file).not.toBeNull();
      expect(file!.path).toBe("hello.ts");
      expect(file!.content).toBe("console.log('hi')");
      expect(file!.language).toBe("typescript");
    });

    it("updates content on second write", () => {
      vfs.write("a.ts", "v1");
      vfs.write("a.ts", "v2");
      expect(vfs.read("a.ts")!.content).toBe("v2");
    });

    it("returns null for nonexistent file", () => {
      expect(vfs.read("nope.ts")).toBeNull();
    });
  });

  describe("language inference", () => {
    it.each([
      ["file.ts", "typescript"],
      ["file.js", "javascript"],
      ["file.sql", "sql"],
      ["file.json", "json"],
      ["file.css", "css"],
      ["file.html", "html"],
      ["file.md", "markdown"],
      ["file.xyz", "typescript"],
    ])("infers %s → %s", (path, lang) => {
      vfs.write(path, "");
      expect(vfs.read(path)!.language).toBe(lang);
    });

    it("allows explicit language override", () => {
      vfs.write("readme", "hello", "markdown");
      expect(vfs.read("readme")!.language).toBe("markdown");
    });
  });

  describe("list", () => {
    it("returns all files sorted by path", () => {
      vfs.write("b.ts", "b");
      vfs.write("a.ts", "a");
      vfs.write("c/d.ts", "d");

      const files = vfs.list();
      expect(files.map((f) => f.path)).toEqual(["a.ts", "b.ts", "c/d.ts"]);
    });

    it("returns empty for fresh VFS", () => {
      expect(vfs.list()).toEqual([]);
    });
  });

  describe("delete", () => {
    it("removes a file", () => {
      vfs.write("a.ts", "x");
      expect(vfs.delete("a.ts")).toBe(true);
      expect(vfs.read("a.ts")).toBeNull();
    });

    it("returns false for nonexistent file", () => {
      expect(vfs.delete("nope")).toBe(false);
    });
  });

  describe("rename", () => {
    it("renames a file", () => {
      vfs.write("old.ts", "content");
      expect(vfs.rename("old.ts", "new.ts")).toBe(true);
      expect(vfs.read("old.ts")).toBeNull();
      expect(vfs.read("new.ts")!.content).toBe("content");
    });

    it("updates language on rename", () => {
      vfs.write("file.ts", "x");
      vfs.rename("file.ts", "file.js");
      expect(vfs.read("file.js")!.language).toBe("javascript");
    });

    it("returns false for nonexistent source", () => {
      expect(vfs.rename("nope", "also-nope")).toBe(false);
    });
  });

  describe("exists", () => {
    it("returns true for existing file", () => {
      vfs.write("a.ts", "");
      expect(vfs.exists("a.ts")).toBe(true);
    });

    it("returns false for nonexistent file", () => {
      expect(vfs.exists("nope")).toBe(false);
    });
  });

  describe("seedDefaults", () => {
    it("seeds files into empty VFS", () => {
      vfs.seedDefaults([
        { path: "a.ts", content: "aa" },
        { path: "b.ts", content: "bb" },
      ]);
      expect(vfs.list()).toHaveLength(2);
    });

    it("does not overwrite existing files", () => {
      vfs.write("a.ts", "existing");
      vfs.seedDefaults([
        { path: "a.ts", content: "new" },
        { path: "b.ts", content: "bb" },
      ]);
      expect(vfs.read("a.ts")!.content).toBe("existing");
      // seedDefaults bails entirely if VFS is non-empty
      expect(vfs.list()).toHaveLength(1);
    });
  });

  describe("onChange", () => {
    it("fires on write", () => {
      let calls = 0;
      vfs.onChange(() => calls++);
      vfs.write("a.ts", "x");
      expect(calls).toBe(1);
    });

    it("fires on delete", () => {
      vfs.write("a.ts", "x");
      let calls = 0;
      vfs.onChange(() => calls++);
      vfs.delete("a.ts");
      expect(calls).toBe(1);
    });

    it("fires on rename", () => {
      vfs.write("a.ts", "x");
      let calls = 0;
      vfs.onChange(() => calls++);
      vfs.rename("a.ts", "b.ts");
      expect(calls).toBe(1);
    });

    it("unsubscribes", () => {
      let calls = 0;
      const unsub = vfs.onChange(() => calls++);
      unsub();
      vfs.write("a.ts", "x");
      expect(calls).toBe(0);
    });
  });

  describe("special characters", () => {
    it("handles single quotes in content", () => {
      vfs.write("a.ts", "it's a test");
      expect(vfs.read("a.ts")!.content).toBe("it's a test");
    });

    it("handles single quotes in path", () => {
      vfs.write("it's.ts", "x");
      expect(vfs.read("it's.ts")!.content).toBe("x");
    });
  });
});
