import { RuleTester } from "eslint";
import rule from "./no-process-bypass.mjs";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

tester.run("no-process-bypass", rule, {
  valid: [
    // Adapter-routed forms
    'import { cwd } from "@blazetrails/activesupport/process-adapter"; cwd();',
    'import { env } from "@blazetrails/activesupport/process-adapter"; env.FOO;',
    'import { setExitCode } from "@blazetrails/activesupport/process-adapter"; setExitCode(1);',
    // Suffix-match safety: identifiers that share a prefix with `process` are fine
    "const myprocess = {}; myprocess.env;",
    // Unrelated property on process is not flagged (only the listed props)
    "process.versions.node;",
    "process.pid;",
    // Nested property access on a non-process object that has the same shape
    "obj.process.env;", // process here is not the global, just a property
  ],
  invalid: [
    // Dotted access — every disallowed prop
    { code: "process.env.FOO;", errors: [{ messageId: "bypass" }] },
    { code: "process.cwd();", errors: [{ messageId: "bypass" }] },
    { code: "process.argv;", errors: [{ messageId: "bypass" }] },
    { code: "process.exit(1);", errors: [{ messageId: "bypass" }] },
    { code: "process.exitCode = 1;", errors: [{ messageId: "bypass" }] },
    { code: "process.stdout.write('x');", errors: [{ messageId: "bypass" }] },
    { code: "process.stderr.write('x');", errors: [{ messageId: "bypass" }] },
    { code: "process.platform;", errors: [{ messageId: "bypass" }] },
    { code: "process.on('SIGINT', () => {});", errors: [{ messageId: "bypass" }] },
    // Optional chaining
    { code: "process?.env;", errors: [{ messageId: "bypass" }] },
    { code: "process?.cwd?.();", errors: [{ messageId: "bypass" }] },
    // Bracket access
    { code: 'process["env"];', errors: [{ messageId: "bypass" }] },
    { code: "process['cwd'];", errors: [{ messageId: "bypass" }] },
    // Optional bracket access
    { code: 'process?.["env"];', errors: [{ messageId: "bypass" }] },
    // process.env presence check (in operator)
    { code: '"FOO" in process.env;', errors: [{ messageId: "bypass" }] },
    // Assignment is also flagged (env mutation)
    { code: "process.env.FOO = 'x';", errors: [{ messageId: "bypass" }] },
  ],
});
