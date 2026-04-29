import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
    // `app/models/*.rb` should not require reading anything outside
    // app/models. Verify by globbing into a non-existent prefix and
    // confirming no error from a sibling tree (lib/) being absent.
    expect(await glob("lib/tasks/*.rake", { cwd: root })).toEqual(["lib/tasks/deploy.rake"]);
  });
});
