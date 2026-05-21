import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { AuthenticationGenerator } from "./authentication-generator.js";
import { parseTs, assertNoRubySource } from "../../../template-builder/testing.js";

let tmpDir: string;

function setupApp() {
  fs.mkdirSync(path.join(tmpDir, "src/app/controllers"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "src/config"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
  fs.writeFileSync(
    path.join(tmpDir, "src/app/controllers/application-controller.ts"),
    `import { ActionController } from "@blazetrails/actionpack";

export class ApplicationController extends ActionController.Base {
}
`,
  );
  fs.writeFileSync(path.join(tmpDir, "src/config/routes.ts"), "// routes\n");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trails-auth-"));
  setupApp();
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

function read(rel: string): string {
  return fs.readFileSync(path.join(tmpDir, rel), "utf-8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(tmpDir, rel));
}
function makeGen() {
  return new AuthenticationGenerator({ cwd: tmpDir, output: () => {} });
}

describe("AuthenticationGenerator", () => {
  it("creates the full authentication file set", () => {
    makeGen().run();
    const emitted = [
      "src/app/models/session.ts",
      "src/app/models/user.ts",
      "src/app/models/current.ts",
      "src/app/controllers/sessions-controller.ts",
      "src/app/controllers/concerns/authentication.ts",
      "src/app/controllers/passwords-controller.ts",
      "src/app/channels/application-cable/connection.ts",
      "src/app/mailers/passwords-mailer.ts",
      "src/app/views/passwords-mailer/reset.html.tse",
      "src/app/views/passwords-mailer/reset.text.tse",
      "test/mailers/previews/passwords-mailer-preview.ts",
    ];
    for (const rel of emitted) expect(exists(rel)).toBe(true);
  });

  it("emits TypeScript that parses without diagnostics and contains no Ruby source", () => {
    makeGen().run();
    for (const rel of [
      "src/app/models/session.ts",
      "src/app/models/user.ts",
      "src/app/models/current.ts",
      "src/app/controllers/sessions-controller.ts",
      "src/app/controllers/concerns/authentication.ts",
      "src/app/controllers/passwords-controller.ts",
      "src/app/channels/application-cable/connection.ts",
      "src/app/mailers/passwords-mailer.ts",
      "test/mailers/previews/passwords-mailer-preview.ts",
    ]) {
      const src = read(rel);
      expect(parseTs(src).diagnostics, `diagnostics for ${rel}`).toEqual([]);
      assertNoRubySource(src);
    }
  });

  it("skips mailer pieces when --skip-mailer is set", () => {
    makeGen().run({ skipMailer: true });
    expect(exists("src/app/mailers/passwords-mailer.ts")).toBe(false);
    expect(exists("src/app/views/passwords-mailer/reset.html.tse")).toBe(false);
    expect(exists("test/mailers/previews/passwords-mailer-preview.ts")).toBe(false);
  });

  it("omits views in api mode but keeps mailer class", () => {
    makeGen().run({ api: true });
    expect(exists("src/app/mailers/passwords-mailer.ts")).toBe(true);
    expect(exists("src/app/views/passwords-mailer/reset.html.tse")).toBe(false);
  });

  it("configures the application controller with Authentication", () => {
    makeGen().run();
    const ac = read("src/app/controllers/application-controller.ts");
    expect(ac).toContain('import { Authentication } from "./concerns/authentication.js";');
    expect(ac).toContain("Authentication.includeInto(this);");
    // Mixin call lands inside the class body (Rails inject_into_class parity).
    const classStart = ac.indexOf("export class ApplicationController");
    const classEnd = ac.indexOf("}", classStart);
    expect(ac.slice(classStart, classEnd)).toContain("Authentication.includeInto(this);");
    // The post-injection file still parses cleanly.
    expect(parseTs(ac).diagnostics).toEqual([]);
  });

  it("is a no-op when application-controller.ts is missing", () => {
    fs.unlinkSync(path.join(tmpDir, "src/app/controllers/application-controller.ts"));
    expect(() => makeGen().run()).not.toThrow();
  });

  it("configures authentication routes", () => {
    makeGen().run();
    const routes = read("src/config/routes.ts");
    expect(routes).toContain('router.resources("passwords", { param: "token" });');
    expect(routes).toContain('router.resource("session");');
  });

  it("is a no-op when routes.ts is missing", () => {
    fs.unlinkSync(path.join(tmpDir, "src/config/routes.ts"));
    expect(() => makeGen().run()).not.toThrow();
  });

  for (const rel of [
    "src/app/models/session.ts",
    "src/app/models/user.ts",
    "src/app/models/current.ts",
    "src/app/controllers/sessions-controller.ts",
    "src/app/controllers/concerns/authentication.ts",
    "src/app/controllers/passwords-controller.ts",
    "src/app/channels/application-cable/connection.ts",
    "src/app/mailers/passwords-mailer.ts",
    "test/mailers/previews/passwords-mailer-preview.ts",
  ]) {
    it(`matches snapshot for ${rel}`, () => {
      makeGen().run();
      expect(read(rel)).toMatchSnapshot();
    });
  }
});
