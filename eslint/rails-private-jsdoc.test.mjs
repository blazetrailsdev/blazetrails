import { RuleTester } from "eslint";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import rule from "./rails-private-jsdoc.mjs";

// Stage a fake repo root with a manifest the rule can resolve.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rails-private-test-"));
fs.writeFileSync(path.join(tmpRoot, "pnpm-workspace.yaml"), "packages: []\n");
const pkgDir = path.join(tmpRoot, "packages/sample/src");
fs.mkdirSync(pkgDir, { recursive: true });
const fileRel = "packages/sample/src/foo.ts";
fs.writeFileSync(
  path.resolve(tmpRoot, "../rails-private-methods.json").replace(/[^/]+$/, "") +
    "rails-private-methods.json",
  "{}",
);
// The rule loads the manifest from its own __dirname; for test purposes we
// just verify the AST visitor logic by writing the manifest to its real path.
// Tests therefore run against a single file whose name matches a real entry
// in the committed manifest (computeType in inheritance.ts).

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parser: (await import("typescript-eslint")).parser,
  },
});

const filename = path.resolve(tmpRoot, "packages/activerecord/src/inheritance.ts");
fs.mkdirSync(path.dirname(filename), { recursive: true });

tester.run("rails-private-jsdoc", rule, {
  valid: [
    {
      filename,
      code: `/** @internal */\nexport function computeType() {}\n`,
    },
    {
      filename,
      code: `export function notInManifest() {}\n`,
    },
  ],
  invalid: [
    {
      filename,
      code: `export function computeType() {}\n`,
      errors: [{ messageId: "missingInternal" }],
      output: `/** @internal */\nexport function computeType() {}\n`,
    },
    {
      filename,
      code: `/**\n * Does a thing.\n */\nexport function computeType() {}\n`,
      errors: [{ messageId: "missingInternal" }],
      output: `/**\n * Does a thing.\n *\n * @internal\n */\nexport function computeType() {}\n`,
    },
  ],
});

fs.rmSync(tmpRoot, { recursive: true, force: true });
console.log("rails-private-jsdoc: ok");
