/**
 * ESLint rule: no-process-bypass
 *
 * Forbids direct `process.<prop>` access for the host operations that
 * trailties routes through `@blazetrails/activesupport`'s processAdapter.
 * Catches both dotted and bracket access, with or without optional
 * chaining. Points the violator at the corresponding adapter export.
 *
 * Scope: this rule has no allow-list of files. Wire it up in
 * `eslint.config.mjs` only for the directories that should follow the
 * adapter contract (e.g. `packages/trailties/src/**`).
 */

const REPLACEMENTS = {
  cwd: { import: "cwd", note: "call cwd() instead" },
  env: { import: "env", note: "use the env snapshot; mutate via setEnv()" },
  argv: { import: "argv", note: "use the argv snapshot" },
  exit: { import: "exit", note: "call exit(code) instead" },
  exitCode: { import: "setExitCode", note: "call setExitCode(code) instead" },
  stdout: { import: "stdout", note: "use stdout.write(...)" },
  stderr: { import: "stderr", note: "use stderr.write(...)" },
  platform: { import: "platform", note: "call platform() instead" },
  on: { import: "onSignal", note: "call onSignal(name, handler) instead" },
};

function isProcessIdentifier(node) {
  return node && node.type === "Identifier" && node.name === "process";
}

function getAccessedProp(node) {
  // node is a MemberExpression. Returns the accessed property name if it
  // matches one of the disallowed props, else null.
  if (!node.computed && node.property.type === "Identifier") {
    return REPLACEMENTS[node.property.name] ? node.property.name : null;
  }
  if (
    node.computed &&
    node.property.type === "Literal" &&
    typeof node.property.value === "string"
  ) {
    return REPLACEMENTS[node.property.value] ? node.property.value : null;
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid direct process.<prop> access in favor of @blazetrails/activesupport/process-adapter exports",
    },
    schema: [],
    messages: {
      bypass:
        "Direct `process.{{prop}}` is not allowed here. Import `{{importName}}` from `@blazetrails/activesupport/process-adapter` and {{note}}.",
    },
  },
  create(context) {
    function check(node) {
      if (!isProcessIdentifier(node.object)) return;
      const prop = getAccessedProp(node);
      if (!prop) return;
      const replacement = REPLACEMENTS[prop];
      context.report({
        node,
        messageId: "bypass",
        data: {
          prop,
          importName: replacement.import,
          note: replacement.note,
        },
      });
    }
    return {
      MemberExpression: check,
    };
  },
};

export default rule;
