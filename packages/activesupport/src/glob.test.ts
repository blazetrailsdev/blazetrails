import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  fsAdapterConfig,
  getFsAsync,
  getPathAsync,
  registerFsAdapter,
  type FsAdapter,
} from "./fs-adapter.js";
import { glob } from "./glob.js";

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "glob-test-"));
  // Layout:
  //   foo.rb
  //   bar.txt
  //   .hidden
  //   app/
  //     models/
  //       user.rb
  //       post.rb
  //       admin.rb
  //     controllers/
  //       application_controller.rb
  //   lib/
  //     tasks/
  //       deploy.rake
  for (const f of ["foo.rb", "bar.txt", ".hidden"]) {
    writeFileSync(join(root, f), "");
  }
  mkdirSync(join(root, "app", "models"), { recursive: true });
  mkdirSync(join(root, "app", "controllers"), { recursive: true });
  mkdirSync(join(root, "lib", "tasks"), { recursive: true });
  for (const f of ["user.rb", "post.rb", "admin.rb"]) {
    writeFileSync(join(root, "app", "models", f), "");
  }
  writeFileSync(join(root, "app", "controllers", "application_controller.rb"), "");
  writeFileSync(join(root, "lib", "tasks", "deploy.rake"), "");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("glob", () => {
  it("matches `*` at root only", async () => {
    expect(await glob("*.rb", { cwd: root })).toEqual(["foo.rb"]);
  });

  it("matches `**/*.rb` at any depth", async () => {
    expect(await glob("**/*.rb", { cwd: root })).toEqual([
      "app/controllers/application_controller.rb",
      "app/models/admin.rb",
      "app/models/post.rb",
      "app/models/user.rb",
      "foo.rb",
    ]);
  });

  it("matches a prefix path with `**`", async () => {
    expect(await glob("app/**/*.rb", { cwd: root })).toEqual([
      "app/controllers/application_controller.rb",
      "app/models/admin.rb",
      "app/models/post.rb",
      "app/models/user.rb",
    ]);
  });

  it("matches `?` for a single char", async () => {
    expect(await glob("ba?.txt", { cwd: root })).toEqual(["bar.txt"]);
  });

  it("matches character classes `[...]`", async () => {
    expect(await glob("app/models/[au]*.rb", { cwd: root })).toEqual([
      "app/models/admin.rb",
      "app/models/user.rb",
    ]);
  });

  it("expands braces `{a,b}`", async () => {
    expect(await glob("**/*.{rb,rake}", { cwd: root })).toEqual([
      "app/controllers/application_controller.rb",
      "app/models/admin.rb",
      "app/models/post.rb",
      "app/models/user.rb",
      "foo.rb",
      "lib/tasks/deploy.rake",
    ]);
  });

  it("hides dotfiles by default", async () => {
    expect(await glob("*", { cwd: root })).not.toContain(".hidden");
  });

  it("includes dotfiles when dot:true", async () => {
    expect(await glob("*", { cwd: root, dot: true })).toContain(".hidden");
  });

  it("returns paths relative to cwd", async () => {
    const result = await glob("**/*.rake", { cwd: root });
    expect(result).toEqual(["lib/tasks/deploy.rake"]);
    for (const p of result) expect(p.startsWith("/")).toBe(false);
  });

  it("returns empty array for unmatched patterns", async () => {
    expect(await glob("nonexistent/**/*.zzz", { cwd: root })).toEqual([]);
  });

  it("handles non-existent cwd gracefully", async () => {
    expect(await glob("*", { cwd: join(root, "does-not-exist") })).toEqual([]);
  });

  it("supports negation via leading `!`", async () => {
    // Brace expansion produces both a positive and a negative pattern.
    expect(await glob("{**/*.rb,!**/admin.rb}", { cwd: root })).toEqual([
      "app/controllers/application_controller.rb",
      "app/models/post.rb",
      "app/models/user.rb",
      "foo.rb",
    ]);
  });

  it("does not throw on unbalanced braces", async () => {
    // Leftover `{` / `}` after brace expansion bails out should be
    // escaped as literals rather than producing an invalid regex.
    await expect(glob("foo{bar.rb", { cwd: root })).resolves.toEqual([]);
    await expect(glob("foo}bar.rb", { cwd: root })).resolves.toEqual([]);
  });

  it("prunes the walk to the literal prefix", async () => {
    // `lib/tasks/*.rake` should ONLY read lib/tasks (not root, not app/,
    // not lib/). Wrap the active fs adapter to record every readdirSync
    // call, then assert none escaped the prefix.
    const realFs = await getFsAsync();
    const realPath = await getPathAsync();
    const reads: string[] = [];
    const tracking: FsAdapter = {
      ...realFs,
      readdirSync: ((p: string, opts?: { withFileTypes: true }) => {
        reads.push(p);
        return opts ? realFs.readdirSync(p, opts) : realFs.readdirSync(p);
      }) as FsAdapter["readdirSync"],
    };
    registerFsAdapter("glob-spy", tracking, realPath);
    fsAdapterConfig.adapter = "glob-spy";
    try {
      const result = await glob("lib/tasks/*.rake", { cwd: root });
      expect(result).toEqual(["lib/tasks/deploy.rake"]);
      // Only directories under lib/tasks (the literal prefix) should be read.
      const expectedPrefix = join(root, "lib", "tasks");
      for (const p of reads) {
        expect(p.startsWith(expectedPrefix)).toBe(true);
      }
      // Sanity: at least one read happened.
      expect(reads.length).toBeGreaterThan(0);
      // Specifically, no read of root, root/app, root/lib (parent), etc.
      expect(reads).not.toContain(root);
      expect(reads).not.toContain(join(root, "app"));
      expect(reads).not.toContain(join(root, "lib"));
    } finally {
      fsAdapterConfig.adapter = null;
    }
  });
});
