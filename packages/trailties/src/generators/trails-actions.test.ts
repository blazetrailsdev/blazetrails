import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fsAdapterConfig,
  registerFsAdapter,
  type FsAdapter,
  type PathAdapter,
} from "@blazetrails/activesupport";
import { GeneratorBase } from "./base.js";

class TestGenerator extends GeneratorBase {}

const path: PathAdapter = {
  join: (...p) => p.filter(Boolean).join("/"),
  dirname: (p) => p.split("/").slice(0, -1).join("/") || "/",
  basename: (p) => p.split("/").pop()!,
  resolve: (...p) => p.filter(Boolean).join("/"),
  extname: (p) => (p.lastIndexOf(".") >= 0 ? p.slice(p.lastIndexOf(".")) : ""),
  isAbsolute: (p) => p.startsWith("/"),
  sep: "/",
};

let files: Map<string, string>;
let dirs: Set<string>;
let previousAdapter: string | null;

function install(): void {
  const fs = {
    exists: async (p: string) => files.has(p) || dirs.has(p),
    readFile: async (p: string) => {
      const v = files.get(p);
      if (v === undefined) throw new Error(`ENOENT: ${p}`);
      return v;
    },
    writeFile: async (p: string, c: string) => void files.set(p, c),
    mkdir: async (p: string) => void dirs.add(p),
  } as unknown as FsAdapter;
  registerFsAdapter("trails-actions-test", fs, path);
  previousAdapter = fsAdapterConfig.adapter;
  fsAdapterConfig.adapter = "trails-actions-test";
}

beforeEach(() => {
  files = new Map();
  dirs = new Set();
  install();
});

afterEach(() => {
  fsAdapterConfig.adapter = previousAdapter;
});

function makeGen(output: (m: string) => void = () => {}): TestGenerator {
  return new TestGenerator({ cwd: "/app", output });
}

describe("TrailsActions", () => {
  describe("pkg", () => {
    it("adds the dependency to package.json", async () => {
      files.set(
        "/app/package.json",
        JSON.stringify({ name: "app", dependencies: { existing: "1.0.0" } }, null, 2) + "\n",
      );
      await makeGen().pkg("left-pad", "^1.3.0");
      const json = JSON.parse(files.get("/app/package.json")!) as {
        dependencies: Record<string, string>;
      };
      expect(json.dependencies).toEqual({ existing: "1.0.0", "left-pad": "^1.3.0" });
    });

    it("defaults version to *", async () => {
      files.set("/app/package.json", JSON.stringify({ name: "app" }, null, 2) + "\n");
      await makeGen().pkg("left-pad");
      const json = JSON.parse(files.get("/app/package.json")!) as {
        dependencies: Record<string, string>;
      };
      expect(json.dependencies["left-pad"]).toBe("*");
    });

    it("with dev option targets devDependencies", async () => {
      files.set("/app/package.json", JSON.stringify({ name: "app" }, null, 2) + "\n");
      await makeGen().pkg("vitest", "^3.0.0", { dev: true });
      const json = JSON.parse(files.get("/app/package.json")!) as {
        devDependencies: Record<string, string>;
      };
      expect(json.devDependencies.vitest).toBe("^3.0.0");
    });
  });

  describe("route", () => {
    it("inserts code before the // routes marker", async () => {
      files.set(
        "/app/src/config/routes.ts",
        `export function drawRoutes(router: any): void {\n  // routes\n}\n`,
      );
      await makeGen().route(`router.resources("posts");`);
      expect(files.get("/app/src/config/routes.ts")).toBe(
        `export function drawRoutes(router: any): void {\n  router.resources("posts");\n  // routes\n}\n`,
      );
    });

    it("errors when the marker is missing", async () => {
      files.set("/app/src/config/routes.ts", "export function drawRoutes() {}\n");
      await expect(makeGen().route("x")).rejects.toThrow(/marker .* not found/);
    });
  });

  describe("environment", () => {
    it("inserts code before the // config marker in application.ts by default", async () => {
      files.set(
        "/app/src/config/application.ts",
        `export const app = {\n  config: {\n    // config\n  },\n};\n`,
      );
      await makeGen().environment(`logLevel: "debug",`);
      expect(files.get("/app/src/config/application.ts")).toBe(
        `export const app = {\n  config: {\n    logLevel: "debug",\n    // config\n  },\n};\n`,
      );
    });

    it("with env option targets the env-specific config file", async () => {
      files.set(
        "/app/src/config/environments/production.ts",
        `export default {\n  // config\n};\n`,
      );
      await makeGen().environment(`logLevel: "warn",`, { env: "production" });
      expect(files.get("/app/src/config/environments/production.ts")).toBe(
        `export default {\n  logLevel: "warn",\n  // config\n};\n`,
      );
    });
  });

  describe("initializer", () => {
    it("writes the file under src/config/initializers/", async () => {
      await makeGen().initializer("my-config.ts", `export const myConfig = { enabled: true };\n`);
      expect(files.get("/app/src/config/initializers/my-config.ts")).toBe(
        `export const myConfig = { enabled: true };\n`,
      );
      expect(dirs.has("/app/src/config/initializers")).toBe(true);
    });

    it("appends a trailing newline when missing", async () => {
      await makeGen().initializer("x.ts", "export const x = 1;");
      expect(files.get("/app/src/config/initializers/x.ts")).toBe("export const x = 1;\n");
    });

    it("rejects Ruby-shape source via assertNoRubySource", async () => {
      await expect(makeGen().initializer("bad.rb", "class Foo\nend\n")).rejects.toThrow(
        /Ruby-like source/,
      );
    });
  });
});
