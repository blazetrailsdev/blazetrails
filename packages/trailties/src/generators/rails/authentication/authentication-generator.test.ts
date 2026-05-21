import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { AuthenticationGenerator } from "./authentication-generator.js";
import { parseTs, assertNoRubySource } from "../../../template-builder/testing.js";

const TS_EMIT = [
  "src/app/models/session.ts",
  "src/app/models/user.ts",
  "src/app/models/current.ts",
  "src/app/controllers/sessions-controller.ts",
  "src/app/controllers/concerns/authentication.ts",
  "src/app/controllers/passwords-controller.ts",
  "src/app/channels/application-cable/connection.ts",
  "src/app/mailers/passwords-mailer.ts",
  "test/mailers/previews/passwords-mailer-preview.ts",
];
const ALL_EMIT = [
  ...TS_EMIT,
  "src/app/views/passwords-mailer/reset.html.tse",
  "src/app/views/passwords-mailer/reset.text.tse",
];

let tmpDir: string;
const read = (rel: string) => fs.readFileSync(path.join(tmpDir, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(tmpDir, rel));
const makeGen = () => new AuthenticationGenerator({ cwd: tmpDir, output: () => {} });

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trails-auth-"));
  fs.mkdirSync(path.join(tmpDir, "src/app/controllers"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "src/config"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
  fs.writeFileSync(
    path.join(tmpDir, "src/app/controllers/application-controller.ts"),
    `import { ActionController } from "@blazetrails/actionpack";\n\nexport class ApplicationController extends ActionController.Base {\n}\n`,
  );
  fs.writeFileSync(path.join(tmpDir, "src/config/routes.ts"), "// routes\n");
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe("AuthenticationGenerator", () => {
  it("creates the full authentication file set", () => {
    makeGen().run();
    for (const rel of ALL_EMIT) expect(exists(rel), rel).toBe(true);
  });

  it("emits TypeScript that parses without diagnostics and contains no Ruby source", () => {
    makeGen().run();
    for (const rel of TS_EMIT) {
      const src = read(rel);
      expect(parseTs(src).diagnostics, `diagnostics for ${rel}`).toEqual([]);
      assertNoRubySource(src);
    }
  });

  it("skips mailer pieces on --skip-mailer; api keeps mailer but drops views", () => {
    makeGen().run({ skipMailer: true });
    expect(exists("src/app/mailers/passwords-mailer.ts")).toBe(false);
    expect(exists("src/app/views/passwords-mailer/reset.html.tse")).toBe(false);
    expect(exists("test/mailers/previews/passwords-mailer-preview.ts")).toBe(false);
    new AuthenticationGenerator({ cwd: tmpDir, output: () => {} }).run({ api: true });
    expect(exists("src/app/mailers/passwords-mailer.ts")).toBe(true);
    expect(exists("src/app/views/passwords-mailer/reset.html.tse")).toBe(false);
  });

  it("wires Authentication into the application controller + adds routes", () => {
    makeGen().run();
    const ac = read("src/app/controllers/application-controller.ts");
    expect(ac).toContain('import { Authentication } from "./concerns/authentication.js";');
    expect(ac).toContain("Authentication.includeInto(this);");
    expect(parseTs(ac).diagnostics).toEqual([]);
    const routes = read("src/config/routes.ts");
    expect(routes).toContain('router.resources("passwords", { param: "token" });');
    expect(routes).toContain('router.resource("session");');
  });

  it("injects the mixin inside the class even when ApplicationController has a body", () => {
    fs.writeFileSync(
      path.join(tmpDir, "src/app/controllers/application-controller.ts"),
      `import { ActionController } from "@blazetrails/actionpack";\n\nexport class ApplicationController extends ActionController.Base {\n  async preexisting(): Promise<void> { return; }\n}\n`,
    );
    makeGen().run();
    const ac = read("src/app/controllers/application-controller.ts");
    expect(parseTs(ac).diagnostics).toEqual([]);
    // A brittle "first }" marker would have landed the injection after
    // the method's closing brace.
    expect(ac.indexOf("Authentication.includeInto")).toBeLessThan(ac.indexOf("preexisting"));
  });

  it("is idempotent — re-running does not duplicate imports or routes", () => {
    makeGen().run();
    const ac = read("src/app/controllers/application-controller.ts");
    const rt = read("src/config/routes.ts");
    makeGen().run();
    expect(read("src/app/controllers/application-controller.ts")).toEqual(ac);
    expect(read("src/config/routes.ts")).toEqual(rt);
    expect(parseTs(ac).diagnostics).toEqual([]);
  });

  it("matches snapshot for the full TS emit set", () => {
    makeGen().run();
    const combined = TS_EMIT.map((rel) => `// === ${rel} ===\n${read(rel)}`).join("\n");
    expect(combined).toMatchSnapshot();
  });
});
