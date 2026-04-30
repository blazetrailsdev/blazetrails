import { RuleTester } from "eslint";
import rule from "./no-process-bypass.mjs";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

const SOURCE = "@blazetrails/activesupport/process-adapter";

tester.run("no-process-bypass", rule, {
  valid: [
    // Adapter-routed forms
    `import { cwd } from "${SOURCE}"; cwd();`,
    `import { env } from "${SOURCE}"; env.FOO;`,
    `import { setExitCode } from "${SOURCE}"; setExitCode(1);`,
    // Suffix-match safety: identifiers that share a prefix with `process` are fine
    "const myprocess = {}; myprocess.env;",
    // Unrelated property on process is not flagged (only the listed props)
    "process.versions.node;",
    "process.pid;",
    // `process` as a property name on another object is not flagged
    "obj.process.env;",
  ],
  invalid: [
    // ── Risky props: flagged but NOT autofixed (local clash risk) ──
    { code: "process.cwd();", errors: [{ messageId: "bypass" }], output: null },
    { code: "process.env.FOO;", errors: [{ messageId: "bypass" }], output: null },
    { code: "process.argv;", errors: [{ messageId: "bypass" }], output: null },
    { code: "process.argv[0];", errors: [{ messageId: "bypass" }], output: null },
    { code: "process?.env;", errors: [{ messageId: "bypass" }], output: null },
    { code: 'process["env"];', errors: [{ messageId: "bypass" }], output: null },
    { code: "process['cwd'];", errors: [{ messageId: "bypass" }], output: null },
    { code: 'process?.["env"];', errors: [{ messageId: "bypass" }], output: null },
    { code: '"FOO" in process.env;', errors: [{ messageId: "bypass" }], output: null },
    { code: "process.env.FOO = 'x';", errors: [{ messageId: "bypass" }], output: null },

    // ── Autofixable props ──
    {
      code: "process.exitCode = 1;",
      errors: [{ messageId: "bypass" }],
      output: `import { setExitCode } from "${SOURCE}";\nsetExitCode(1);`,
    },
    {
      code: "process.exit(2);",
      errors: [{ messageId: "bypass" }],
      output: `import { exit } from "${SOURCE}";\nexit(2);`,
    },
    {
      code: "process.platform;",
      errors: [{ messageId: "bypass" }],
      output: `import { platform } from "${SOURCE}";\nplatform();`,
    },
    {
      code: "process.stdout.write('hi');",
      errors: [{ messageId: "bypass" }],
      output: `import { stdout } from "${SOURCE}";\nstdout.write('hi');`,
    },
    {
      code: "process.stderr.write('err');",
      errors: [{ messageId: "bypass" }],
      output: `import { stderr } from "${SOURCE}";\nstderr.write('err');`,
    },
    {
      code: "process.on('SIGINT', () => {});",
      errors: [{ messageId: "bypass" }],
      output: `import { onSignal } from "${SOURCE}";\nonSignal('SIGINT', () => {});`,
    },

    // ── Import merging: append to existing import from the same source ──
    {
      code: `import { cwd } from "${SOURCE}";\nprocess.exitCode = 0;`,
      errors: [{ messageId: "bypass" }],
      output: `import { cwd, setExitCode } from "${SOURCE}";\nsetExitCode(0);`,
    },
    // Already-imported (possibly aliased) symbol: reuse the local name.
    {
      code: `import { setExitCode as setEC } from "${SOURCE}";\nprocess.exitCode = 1;`,
      errors: [{ messageId: "bypass" }],
      output: `import { setExitCode as setEC } from "${SOURCE}";\nsetEC(1);`,
    },
  ],
});
