import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ResourceRouteGenerator } from "./resource-route-generator.js";

let tmpDir: string;
const seed = (): void => {
  fs.mkdirSync(path.join(tmpDir, "src/config"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "src/config/routes.ts"),
    "export function drawRoutes(router: any): void {\n  // routes\n}\n",
  );
};
const read = (): string => fs.readFileSync(path.join(tmpDir, "src/config/routes.ts"), "utf-8");
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trails-route-"));
  seed();
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe("ResourceRouteGeneratorTest", () => {
  it("add resource route", () => {
    new ResourceRouteGenerator({
      cwd: tmpDir,
      output: () => {},
      name: "product",
    }).addResourceRoute();
    expect(read()).toContain('router.resources("products");');
  });

  it("nests namespaces", () => {
    new ResourceRouteGenerator({
      cwd: tmpDir,
      output: () => {},
      name: "admin/users/product",
    }).addResourceRoute();
    const c = read();
    expect(c).toContain('router.namespace("admin"');
    expect(c).toContain('router.namespace("users"');
    expect(c).toContain('router.resources("products");');
  });

  it("skips when actions are present", () => {
    new ResourceRouteGenerator({ cwd: tmpDir, output: () => {}, name: "product" }).addResourceRoute(
      {
        actions: ["index"],
      },
    );
    expect(read()).not.toContain("router.resources");
  });
});
