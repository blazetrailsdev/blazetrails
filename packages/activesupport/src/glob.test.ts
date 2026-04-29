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

  it("handles non-existent cwd gracefully (swallows ENOENT/ENOTDIR)", async () => {
    // walk() catches ENOENT/ENOTDIR (expected absence) and returns [].
    // Other errors (EACCES etc.) propagate — covered by a separate test.
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
    const prevAdapter = fsAdapterConfig.adapter;
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
      fsAdapterConfig.adapter = prevAdapter;
    }
  });

  it("does not recurse below the pattern's max depth (no `**`)", async () => {
    // Pattern `app/*/*.rb` allows exactly one directory level below `app`.
    // Without depth pruning, walk would descend further if any subdir
    // contained nested dirs. Verify by creating a deep nested tree under
    // app/models and confirming readdirSync was never called on the
    // deepest level.
    const deep = join(root, "app", "models", "deep1", "deep2", "deep3");
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(deep, "should-not-be-read.rb"), "");
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
    const prevAdapter = fsAdapterConfig.adapter;
    registerFsAdapter("glob-spy-depth", tracking, realPath);
    fsAdapterConfig.adapter = "glob-spy-depth";
    try {
      // Pattern matches exactly one dir under app, then a *.rb file.
      // Pattern depth from base "app" = 1 (one trailing /).
      const result = await glob("app/*/*.rb", { cwd: root });
      expect(result).toContain("app/models/admin.rb");
      // Should have read app/ (depth 0) and app/models, app/controllers
      // (depth 1). Should NOT have read deep1, deep2, deep3.
      expect(reads).toContain(join(root, "app"));
      expect(reads).toContain(join(root, "app", "models"));
      expect(reads).not.toContain(join(root, "app", "models", "deep1"));
      expect(reads).not.toContain(join(root, "app", "models", "deep1", "deep2"));
    } finally {
      fsAdapterConfig.adapter = prevAdapter;
      // Cleanup the deep tree so other tests aren't affected.
      rmSync(join(root, "app", "models", "deep1"), { recursive: true, force: true });
    }
  });

  it("uses an existence check for fully literal patterns (no walk)", async () => {
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
    const prevAdapter = fsAdapterConfig.adapter;
    registerFsAdapter("glob-spy-literal", tracking, realPath);
    fsAdapterConfig.adapter = "glob-spy-literal";
    try {
      const found = await glob("foo.rb", { cwd: root });
      expect(found).toEqual(["foo.rb"]);
      const missing = await glob("nonexistent.rb", { cwd: root });
      expect(missing).toEqual([]);
      // Literal short-circuit: no readdirSync calls should have happened.
      expect(reads).toEqual([]);
    } finally {
      fsAdapterConfig.adapter = prevAdapter;
    }
  });

  it("does not count `/` inside character classes when computing depth", async () => {
    // `app/[/]bar` has only one real path separator. The `/` inside
    // [/] must not inflate maxDepth — which the (?![/]) guard would
    // make match nothing anyway, but pruning should still be tight.
    // Spy on readdirSync and confirm we only read app, not deeper.
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
    const prevAdapter = fsAdapterConfig.adapter;
    registerFsAdapter("glob-spy-class-slash", tracking, realPath);
    fsAdapterConfig.adapter = "glob-spy-class-slash";
    try {
      // Pattern `app/[abc]bar` has only one real separator (depth=0
      // remaining after base=`app`). Confirm walk doesn't descend
      // below app/.
      await glob("app/[abc]bar", { cwd: root });
      expect(reads).toContain(join(root, "app"));
      expect(reads).not.toContain(join(root, "app", "models"));
      expect(reads).not.toContain(join(root, "app", "controllers"));
    } finally {
      fsAdapterConfig.adapter = prevAdapter;
    }
  });

  it("treats in-segment `**` as plain `*` (no unbounded depth)", async () => {
    // Build a deep tree under app/models. Pattern `app/foo**bar.rb`
    // (with `**` in-segment, not as a path segment) should NOT match
    // anything across directory boundaries — `**` here is just `*`.
    const deep = join(root, "app", "models", "deep1", "deep2");
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(deep, "fooXbar.rb"), "");
    try {
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
      const prevAdapter = fsAdapterConfig.adapter;
      registerFsAdapter("glob-spy-instar", tracking, realPath);
      fsAdapterConfig.adapter = "glob-spy-instar";
      try {
        // `app/foo**bar.rb`: in-segment **, single-segment match. Should
        // NOT recurse into deep1/deep2 since maxRemainingDepth is bounded.
        await glob("app/foo**bar.rb", { cwd: root });
        expect(reads).not.toContain(join(root, "app", "models", "deep1"));
        expect(reads).not.toContain(join(root, "app", "models", "deep1", "deep2"));
      } finally {
        fsAdapterConfig.adapter = prevAdapter;
      }
    } finally {
      rmSync(join(root, "app", "models", "deep1"), { recursive: true, force: true });
    }
  });

  it("literal-pattern fast path rethrows EACCES instead of swallowing", async () => {
    const realFs = await getFsAsync();
    const realPath = await getPathAsync();
    const erroring: FsAdapter = {
      ...realFs,
      statSync: (() => {
        const err = new Error("EACCES: permission denied") as Error & { code: string };
        err.code = "EACCES";
        throw err;
      }) as FsAdapter["statSync"],
    };
    const prevAdapter = fsAdapterConfig.adapter;
    registerFsAdapter("glob-eacces-stat", erroring, realPath);
    fsAdapterConfig.adapter = "glob-eacces-stat";
    try {
      // Literal pattern (no glob chars) hits the fast path which uses
      // statSync. EACCES must propagate.
      await expect(glob("foo.rb", { cwd: root })).rejects.toThrow(/EACCES/);
    } finally {
      fsAdapterConfig.adapter = prevAdapter;
    }
  });

  it("character classes do not match `/` (segment boundary preserved)", async () => {
    // a[/]b would match a/b without the (?![/])[...] guard. There is
    // no real file with that name, so the result must be empty rather
    // than crossing into a sibling directory.
    expect(await glob("app[/]models", { cwd: root })).toEqual([]);
    // Negation: ensure normal classes still work
    expect(await glob("app/models/[au]*.rb", { cwd: root })).toEqual([
      "app/models/admin.rb",
      "app/models/user.rb",
    ]);
  });

  it("escapes backslashes inside character classes (no invalid regex)", async () => {
    // [\b] would otherwise compile to a class containing the JS regex
    // backspace escape; [a\b] could match unexpected chars. We escape
    // backslashes so the class is well-defined.
    await expect(glob("[\\b].rb", { cwd: root })).resolves.toEqual([]);
    await expect(glob("[a\\b]", { cwd: root })).resolves.toEqual([]);
  });

  it("matches dotfiles when the pattern explicitly references a dot segment", async () => {
    // .hidden exists at root from the test fixture. Pattern '.hidden'
    // (or '**/.hidden') should match without setting dot:true, mirroring
    // picomatch behavior.
    expect(await glob(".hidden", { cwd: root })).toEqual([".hidden"]);
    expect(await glob("**/.hidden", { cwd: root })).toEqual([".hidden"]);
    // Without explicit dot reference, default dot:false still hides them.
    expect(await glob("*", { cwd: root })).not.toContain(".hidden");
  });

  it("rejects absolute patterns", async () => {
    await expect(glob("/tmp/**/*.rb", { cwd: root })).rejects.toThrow(
      /absolute patterns are not supported/,
    );
    await expect(glob("/etc/passwd", { cwd: root })).rejects.toThrow(
      /absolute patterns are not supported/,
    );
    // Windows-absolute form
    await expect(glob("C:/Users/foo/*.rb", { cwd: root })).rejects.toThrow(
      /absolute patterns are not supported/,
    );
    // Backslash leading separator
    await expect(glob("\\windows\\foo", { cwd: root })).rejects.toThrow(
      /absolute patterns are not supported/,
    );
    // Drive-relative (no slash after the colon)
    await expect(glob("C:foo\\bar", { cwd: root })).rejects.toThrow(
      /absolute patterns are not supported/,
    );
    await expect(glob("D:relative.rb", { cwd: root })).rejects.toThrow(
      /absolute patterns are not supported/,
    );
  });

  it("rejects `..` segments that could escape cwd (both separator forms)", async () => {
    await expect(glob("../etc/passwd", { cwd: root })).rejects.toThrow(
      /'\.\.' segments are not supported/,
    );
    await expect(glob("app/../../escape", { cwd: root })).rejects.toThrow(
      /'\.\.' segments are not supported/,
    );
    // Backslash-separated traversal — Windows-flavored PathAdapter
    // would otherwise route this through `path.join(cwd, "..\\foo")`.
    await expect(glob("..\\escape", { cwd: root })).rejects.toThrow(
      /'\.\.' segments are not supported/,
    );
    await expect(glob("app\\..\\escape", { cwd: root })).rejects.toThrow(
      /'\.\.' segments are not supported/,
    );
  });

  it("rejects mid-pattern backslashes outside character classes", async () => {
    // Without the check, `app\\models\\*.rb` validates fine but never
    // matches because the rest of the impl only understands `/`.
    await expect(glob("app\\models\\*.rb", { cwd: root })).rejects.toThrow(
      /backslashes outside character classes are not supported/,
    );
    // Bracket-class backslashes are still allowed (they're escapes).
    await expect(glob("[\\b].rb", { cwd: root })).resolves.toEqual([]);
    await expect(glob("[a\\b]", { cwd: root })).resolves.toEqual([]);
  });

  it("rejects unsafe forms produced by brace expansion (post-expansion validation)", async () => {
    // {..,foo}/bar expands to ["../bar", "foo/bar"]. Pre-expansion
    // validation would let this through; post-expansion validation
    // catches the traversal branch.
    await expect(glob("{..,foo}/bar", { cwd: root })).rejects.toThrow(
      /'\.\.' segments are not supported/,
    );
    // {/etc/passwd,foo} expands to ["/etc/passwd", "foo"]. The first
    // branch is absolute and would escape cwd via path.join.
    await expect(glob("{/etc/passwd,foo}", { cwd: root })).rejects.toThrow(
      /absolute patterns are not supported/,
    );
    // Negated unsafe branches must also be rejected: a negative pattern
    // shouldn't let an attacker probe paths outside cwd via timing/effects.
    await expect(glob("foo,{!/etc/passwd}", { cwd: root })).resolves.toEqual([]);
    await expect(glob("{foo,!../escape}", { cwd: root })).rejects.toThrow(
      /'\.\.' segments are not supported/,
    );
  });

  it("ignores empty patterns produced by brace expansion edge cases", async () => {
    // `{a,}` expands to ["a", ""]; without filtering, the empty pattern
    // would cause the literal fast path to statSync(cwd) and emit "".
    expect(await glob("{foo.rb,}", { cwd: root })).toEqual(["foo.rb"]);
    expect(await glob("{,foo.rb}", { cwd: root })).toEqual(["foo.rb"]);
    // Bare empty pattern resolves to nothing.
    expect(await glob("", { cwd: root })).toEqual([]);
  });

  it("does not throw on empty character class `[]` (routed to fast path)", async () => {
    // Empty character class is legal-but-matches-nothing in some JS
    // engines and a syntax error in others. We treat it as a literal
    // `[]` so glob() always behaves predictably. Verify by spying that
    // no readdirSync calls happen — the literal-fast-path takes over.
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
    const prevAdapter = fsAdapterConfig.adapter;
    registerFsAdapter("glob-spy-empty", tracking, realPath);
    fsAdapterConfig.adapter = "glob-spy-empty";
    try {
      await expect(glob("foo[]", { cwd: root })).resolves.toEqual([]);
      expect(reads).toEqual([]);
    } finally {
      fsAdapterConfig.adapter = prevAdapter;
    }
  });

  it("treats unbalanced { } [ ] as literals (no walk)", async () => {
    // foo{bar.rb has '{' but no matching '}' — patternToRegex escapes
    // it as a literal, and the walk-vs-fast-path decision should also
    // treat it as literal so it skips the directory walk entirely.
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
    const prevAdapter = fsAdapterConfig.adapter;
    registerFsAdapter("glob-spy-unbalanced", tracking, realPath);
    fsAdapterConfig.adapter = "glob-spy-unbalanced";
    try {
      // Three unbalanced cases — none should trigger a walk.
      await glob("foo{bar.rb", { cwd: root });
      await glob("foo}bar.rb", { cwd: root });
      // Single '[' with no matching ']' — also literal.
      await glob("foo[bar.rb", { cwd: root });
      expect(reads).toEqual([]);
    } finally {
      fsAdapterConfig.adapter = prevAdapter;
    }
  });

  // Note: literal-backslash patterns outside character classes are
  // rejected by the validator (see "rejects mid-pattern backslashes
  // outside character classes"). Backslash-in-class patterns are
  // covered by "escapes backslashes inside character classes".

  it("rethrows unexpected readdirSync errors (e.g. EACCES)", async () => {
    const realFs = await getFsAsync();
    const realPath = await getPathAsync();
    const erroring: FsAdapter = {
      ...realFs,
      readdirSync: ((p: string) => {
        const err = new Error("EACCES: permission denied") as Error & { code: string };
        err.code = "EACCES";
        throw err;
      }) as FsAdapter["readdirSync"],
    };
    const prevAdapter = fsAdapterConfig.adapter;
    registerFsAdapter("glob-eacces", erroring, realPath);
    fsAdapterConfig.adapter = "glob-eacces";
    try {
      await expect(glob("**/*.rb", { cwd: root })).rejects.toThrow(/EACCES/);
    } finally {
      fsAdapterConfig.adapter = prevAdapter;
    }
  });

  it("handles deep directory trees without stack overflow (iterative walk)", async () => {
    // Build a deeply nested structure (200 levels) under a sibling root.
    const deepRoot = join(root, "deep-stack-test");
    let cur = deepRoot;
    for (let i = 0; i < 200; i++) {
      cur = join(cur, `d${i}`);
    }
    mkdirSync(cur, { recursive: true });
    writeFileSync(join(cur, "leaf.rb"), "");
    try {
      const found = await glob("**/leaf.rb", { cwd: deepRoot });
      expect(found.length).toBe(1);
      expect(found[0]!.endsWith("leaf.rb")).toBe(true);
    } finally {
      rmSync(deepRoot, { recursive: true, force: true });
    }
  });
});
