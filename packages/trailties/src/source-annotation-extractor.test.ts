import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  fsAdapterConfig,
  registerFsAdapter,
  type FsAdapter,
  type FsDirent,
  type PathAdapter,
} from "@blazetrails/activesupport";
import {
  Annotation,
  SourceAnnotationExtractor,
  registerDirectories,
  registerExtensions,
  registerTags,
  resetAnnotationRegistry,
} from "./source-annotation-extractor.js";

const posixPath: PathAdapter = {
  join: (...p: string[]) =>
    p
      .filter((x) => x.length > 0)
      .join("/")
      .replace(/\/+/g, "/"),
  dirname: (p: string) => p.replace(/\/[^/]*$/, "") || "/",
  basename: (p: string) => p.split("/").pop() ?? "",
  resolve: (...p: string[]) => p.join("/").replace(/\/+/g, "/"),
  extname: (p: string) => (p.lastIndexOf(".") > 0 ? p.slice(p.lastIndexOf(".")) : ""),
  isAbsolute: (p: string) => p.startsWith("/"),
  sep: "/",
};

const files = new Map<string, string>();
function dirChildren(dir: string): FsDirent[] {
  const prefix = dir.endsWith("/") ? dir : `${dir}/`;
  const seen = new Set<string>();
  const out: FsDirent[] = [];
  for (const f of files.keys()) {
    if (!f.startsWith(prefix)) continue;
    const rest = f.slice(prefix.length);
    const slash = rest.indexOf("/");
    const isDir = slash !== -1;
    const name = isDir ? rest.slice(0, slash) : rest;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, isDirectory: () => isDir, isFile: () => !isDir });
  }
  return out;
}
const memoryFs = {
  cwd: () => "/",
  exists: async (p: string) => {
    if (files.has(p)) return true;
    const prefix = p.endsWith("/") ? p : `${p}/`;
    for (const f of files.keys()) if (f.startsWith(prefix)) return true;
    return false;
  },
  readFile: async (p: string) => {
    const v = files.get(p);
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return v;
  },
  readdirSync: (p: string, options?: { withFileTypes: true }) => {
    const d = dirChildren(p);
    return options?.withFileTypes ? d : d.map((x) => x.name);
  },
} as unknown as FsAdapter;

const PREV = fsAdapterConfig.adapter;
beforeEach(() => {
  files.clear();
  registerFsAdapter("notes-test", memoryFs, posixPath);
  fsAdapterConfig.adapter = "notes-test";
  resetAnnotationRegistry();
});
afterEach(() => {
  fsAdapterConfig.adapter = PREV;
  resetAnnotationRegistry();
});

const w = (p: string, c: string): void => void files.set(p, c);
const run = (tag: string | null = null, showTag = true): Promise<string> =>
  SourceAnnotationExtractor.enumerate(tag, { tag: showTag });

describe("Rails::Command::NotesTest", () => {
  test("`rails notes` displays results for default directories and default annotations with aligned line number and annotation tag", async () => {
    w("app/controllers/some_controller.ts", "// OPTIMIZE: note in app directory");
    w("config/initializers/some_initializer.ts", "// TODO: note in config directory");
    w("db/some_seeds.ts", "// FIXME: note in db directory");
    w("lib/some_file.ts", "// TODO: note in lib directory");
    w("test/some_test.ts", "\n".repeat(100) + "// FIXME: note in test directory");
    w("some_other_dir/blah.ts", "// TODO: note in some_other directory");
    expect(await run()).toBe(
      `app/controllers/some_controller.ts:\n  * [  1] [OPTIMIZE] note in app directory\n\n` +
        `config/initializers/some_initializer.ts:\n  * [  1] [TODO] note in config directory\n\n` +
        `db/some_seeds.ts:\n  * [  1] [FIXME] note in db directory\n\n` +
        `lib/some_file.ts:\n  * [  1] [TODO] note in lib directory\n\n` +
        `test/some_test.ts:\n  * [101] [FIXME] note in test directory\n\n`,
    );
  });

  test("`rails notes` displays an empty string when no results were found", async () => {
    expect(await run()).toBe("");
  });

  test("`rails notes --annotations` displays results for a single annotation without being prefixed by a tag", async () => {
    w("db/some_seeds.ts", "// FIXME: note in db directory");
    w("test/some_test.ts", "// FIXME: note in test directory");
    w("app/controllers/some_controller.ts", "// OPTIMIZE: note in app directory");
    w("config/initializers/some_initializer.ts", "// TODO: note in config directory");
    expect(await run("FIXME", false)).toBe(
      `db/some_seeds.ts:\n  * [1] note in db directory\n\n` +
        `test/some_test.ts:\n  * [1] note in test directory\n\n`,
    );
  });

  test("`rails notes --annotations` displays results for multiple annotations being prefixed by a tag", async () => {
    w("app/controllers/some_controller.ts", "// FOOBAR: note in app directory");
    w("config/initializers/some_initializer.ts", "// TODO: note in config directory");
    w("lib/some_file.ts", "// TODO: note in lib directory");
    w("test/some_test.ts", "// FIXME: note in test directory");
    expect(await run("FOOBAR|TODO")).toBe(
      `app/controllers/some_controller.ts:\n  * [1] [FOOBAR] note in app directory\n\n` +
        `config/initializers/some_initializer.ts:\n  * [1] [TODO] note in config directory\n\n` +
        `lib/some_file.ts:\n  * [1] [TODO] note in lib directory\n\n`,
    );
  });

  test("displays results from additional directories added to the default directories from a config file", async () => {
    w("db/some_seeds.ts", "// FIXME: note in db directory");
    w("lib/some_file.ts", "// TODO: note in lib directory");
    w("spec/spec_helper.ts", "// TODO: note in spec");
    w("spec/models/user_spec.ts", "// TODO: note in model spec");
    registerDirectories("spec");
    expect(await run()).toBe(
      `db/some_seeds.ts:\n  * [1] [FIXME] note in db directory\n\n` +
        `lib/some_file.ts:\n  * [1] [TODO] note in lib directory\n\n` +
        `spec/models/user_spec.ts:\n  * [1] [TODO] note in model spec\n\n` +
        `spec/spec_helper.ts:\n  * [1] [TODO] note in spec\n\n`,
    );
  });

  test("displays results from additional file extensions added to the default extensions from a config file", async () => {
    registerExtensions(["scss", "sass"], (tag) => new RegExp(`//\\s*(${tag}):?\\s*(.*)$`));
    w("db/some_seeds.ts", "// FIXME: note in db directory");
    w("app/assets/stylesheets/application.css.scss", "// TODO: note in scss");
    w("app/assets/stylesheets/application.css.sass", "// TODO: note in sass");
    expect(await run()).toBe(
      `app/assets/stylesheets/application.css.sass:\n  * [1] [TODO] note in sass\n\n` +
        `app/assets/stylesheets/application.css.scss:\n  * [1] [TODO] note in scss\n\n` +
        `db/some_seeds.ts:\n  * [1] [FIXME] note in db directory\n\n`,
    );
  });

  test("displays results from additional tags added to the default tags from a config file", async () => {
    w("app/models/profile.ts", "// TESTME: some method to test");
    w("app/controllers/hello_controller.ts", "// DEPRECATEME: this action is no longer needed");
    w("db/some_seeds.ts", "// TODO: default tags such as TODO are still present");
    registerTags("TESTME", "DEPRECATEME");
    expect(await run()).toBe(
      `app/controllers/hello_controller.ts:\n  * [1] [DEPRECATEME] this action is no longer needed\n\n` +
        `app/models/profile.ts:\n  * [1] [TESTME] some method to test\n\n` +
        `db/some_seeds.ts:\n  * [1] [TODO] default tags such as TODO are still present\n\n`,
    );
  });

  test("does not display results from tags that are neither default nor registered", async () => {
    w("app/models/profile.ts", "// TESTME: some method to test");
    w("app/controllers/hello_controller.ts", "// DEPRECATEME: this action is no longer needed");
    w("db/some_seeds.ts", "// TODO: default tags such as TODO are still present");
    w("db/some_other_seeds.ts", "// BAD: this note should not be listed");
    registerTags("TESTME", "DEPRECATEME");
    expect(await run()).toBe(
      `app/controllers/hello_controller.ts:\n  * [1] [DEPRECATEME] this action is no longer needed\n\n` +
        `app/models/profile.ts:\n  * [1] [TESTME] some method to test\n\n` +
        `db/some_seeds.ts:\n  * [1] [TODO] default tags such as TODO are still present\n\n`,
    );
  });

  test("Annotation toString variants", () => {
    expect(new Annotation(7, "TODO", "x").toString()).toBe("[7] x");
    expect(new Annotation(7, "TODO", "x").toString({ tag: true })).toBe("[7] [TODO] x");
    expect(new Annotation(7, "TODO", "x").toString({ indent: 3 })).toBe("[  7] x");
  });
});
