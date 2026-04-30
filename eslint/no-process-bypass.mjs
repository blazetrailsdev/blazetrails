/**
 * ESLint rule: no-process-bypass
 *
 * Forbids direct `process.<prop>` access for the host operations that
 * trailties routes through `@blazetrails/activesupport`'s processAdapter.
 * Catches both dotted and bracket access, with or without optional
 * chaining. Points the violator at the corresponding adapter export.
 *
 * Autofix: enabled for properties where the replacement symbol is
 * unlikely to clash with local code (`setExitCode`, `onSignal`,
 * `platform`, `exit`, `stdout`, `stderr`). Skipped for `cwd`, `env`,
 * and `argv` since those names are commonly used as local variables;
 * the user should pick an alias rather than risk silent shadowing.
 *
 * Scope: this rule has no allow-list of files. Wire it up in
 * `eslint.config.mjs` only for the directories that should follow the
 * adapter contract (e.g. `packages/trailties/src/**`).
 */

const SOURCE = "@blazetrails/activesupport/process-adapter";

// Each entry describes one disallowed property. `fixable` controls
// whether autofix runs; `rewrite(node, fixer, localName)` returns the
// list of fixer ops for the replacement (excluding the import — that
// is handled centrally).
const REPLACEMENTS = {
  cwd: {
    importName: "cwd",
    note: "call cwd() instead",
    fixable: false, // local `cwd` variables are too common to autofix safely
  },
  env: {
    importName: "env",
    note: "use the env snapshot; mutate via setEnv()",
    fixable: false,
  },
  argv: {
    importName: "argv",
    note: "use the argv snapshot",
    fixable: false,
  },
  exit: {
    importName: "exit",
    note: "call exit(code) instead",
    fixable: true,
    // process.exit(c) → exit(c): replace just `process.exit` with `exit`
    rewrite(memberNode, fixer, localName) {
      return [fixer.replaceText(memberNode, localName)];
    },
  },
  exitCode: {
    importName: "setExitCode",
    note: "call setExitCode(code) instead",
    fixable: true,
    // process.exitCode = N → setExitCode(N): rewrite the parent
    // AssignmentExpression. Only autofix when parent is `=` assignment;
    // bare reads of process.exitCode are rare enough to leave alone.
    rewrite(memberNode, fixer, localName, context) {
      const parent = memberNode.parent;
      if (
        parent &&
        parent.type === "AssignmentExpression" &&
        parent.operator === "=" &&
        parent.left === memberNode
      ) {
        const sourceCode = context.sourceCode || context.getSourceCode();
        const valueText = sourceCode.getText(parent.right);
        return [fixer.replaceText(parent, `${localName}(${valueText})`)];
      }
      return null;
    },
  },
  stdout: {
    importName: "stdout",
    note: "use stdout.write(...)",
    fixable: true,
    rewrite(memberNode, fixer, localName) {
      return [fixer.replaceText(memberNode, localName)];
    },
  },
  stderr: {
    importName: "stderr",
    note: "use stderr.write(...)",
    fixable: true,
    rewrite(memberNode, fixer, localName) {
      return [fixer.replaceText(memberNode, localName)];
    },
  },
  platform: {
    importName: "platform",
    note: "call platform() instead",
    fixable: true,
    // process.platform → platform() — turn the property access into a call.
    rewrite(memberNode, fixer, localName) {
      return [fixer.replaceText(memberNode, `${localName}()`)];
    },
  },
  on: {
    importName: "onSignal",
    note: "call onSignal(name, handler) instead",
    fixable: true,
    // process.on(...) → onSignal(...): replace `process.on` with `onSignal`.
    rewrite(memberNode, fixer, localName) {
      return [fixer.replaceText(memberNode, localName)];
    },
  },
};

/**
 * Unwrap TypeScript wrapper expressions that don't change the runtime
 * value: non-null assertion (`x!`), type assertions (`x as T`,
 * `<T>x`), and parenthesized expressions. Without unwrapping, forms
 * like `process!.env` or `(process as any).env` would silently bypass
 * the rule.
 */
function unwrap(node) {
  while (
    node &&
    (node.type === "TSNonNullExpression" ||
      node.type === "TSAsExpression" ||
      node.type === "TSTypeAssertion" ||
      node.type === "TSSatisfiesExpression" ||
      node.type === "ParenthesizedExpression")
  ) {
    node = node.expression;
  }
  return node;
}

function isProcessIdentifier(node) {
  const inner = unwrap(node);
  return inner && inner.type === "Identifier" && inner.name === "process";
}

function getAccessedProp(node) {
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

/**
 * Find an existing `import ... from "@blazetrails/activesupport/process-adapter"`
 * statement in the file. Returns the ImportDeclaration node or null.
 */
function findAdapterImport(programBody) {
  for (const stmt of programBody) {
    if (
      stmt.type === "ImportDeclaration" &&
      stmt.source.value === SOURCE &&
      stmt.importKind !== "type"
    ) {
      return stmt;
    }
  }
  return null;
}

/**
 * If `importDecl` already imports `name` (possibly aliased), return the
 * local name. Otherwise return null.
 */
function findSpecifier(importDecl, name) {
  for (const spec of importDecl.specifiers) {
    if (spec.type === "ImportSpecifier" && spec.imported.name === name) {
      return spec.local.name;
    }
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    fixable: "code",
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
    /**
     * Catch destructuring forms: `const { env, cwd } = process;` and
     * `const { env: e } = process;`. Each disallowed property in the
     * pattern is reported separately so the message points at the
     * exact violation.
     */
    function checkDestructuring(declarator) {
      if (!declarator.init) return;
      if (declarator.id.type !== "ObjectPattern") return;
      if (!isProcessIdentifier(declarator.init)) return;
      for (const propNode of declarator.id.properties) {
        if (propNode.type !== "Property" || propNode.computed) continue;
        const keyName =
          propNode.key.type === "Identifier"
            ? propNode.key.name
            : propNode.key.type === "Literal" && typeof propNode.key.value === "string"
              ? propNode.key.value
              : null;
        if (!keyName || !REPLACEMENTS[keyName]) continue;
        const replacement = REPLACEMENTS[keyName];
        context.report({
          node: propNode,
          messageId: "bypass",
          data: {
            prop: keyName,
            importName: replacement.importName,
            note: replacement.note,
          },
        });
      }
    }

    return {
      VariableDeclarator: checkDestructuring,
      MemberExpression(node) {
        if (!isProcessIdentifier(node.object)) return;
        const prop = getAccessedProp(node);
        if (!prop) return;
        const replacement = REPLACEMENTS[prop];
        const sourceCode = context.sourceCode || context.getSourceCode();

        const report = {
          node,
          messageId: "bypass",
          data: {
            prop,
            importName: replacement.importName,
            note: replacement.note,
          },
        };

        if (replacement.fixable) {
          report.fix = (fixer) => {
            const program = sourceCode.ast;
            const existingImport = findAdapterImport(program.body);
            const existingLocal = existingImport
              ? findSpecifier(existingImport, replacement.importName)
              : null;
            const localName = existingLocal ?? replacement.importName;

            const rewriteFixes = replacement.rewrite(node, fixer, localName, context);
            if (!rewriteFixes) return null;

            // Already imported under that name — just rewrite the access.
            if (existingLocal) return rewriteFixes;

            // No existing import or no specifier — add one.
            if (existingImport) {
              // Append to existing import from the same source. Bail if
              // it uses default/namespace forms (mixed forms are awkward).
              const onlyNamed = existingImport.specifiers.every(
                (s) => s.type === "ImportSpecifier",
              );
              if (!onlyNamed) return null;
              if (existingImport.specifiers.length === 0) {
                // Edge case: `import {} from "..."` — replace whole import
                return [
                  fixer.replaceText(
                    existingImport,
                    `import { ${replacement.importName} } from "${SOURCE}";`,
                  ),
                  ...rewriteFixes,
                ];
              }
              const lastSpec = existingImport.specifiers[existingImport.specifiers.length - 1];
              return [
                fixer.insertTextAfter(lastSpec, `, ${replacement.importName}`),
                ...rewriteFixes,
              ];
            }

            // Insert a new import at the top of the file.
            const firstStmt = program.body[0];
            const importText = `import { ${replacement.importName} } from "${SOURCE}";\n`;
            return [
              firstStmt
                ? fixer.insertTextBefore(firstStmt, importText)
                : fixer.insertTextAfterRange([0, 0], importText),
              ...rewriteFixes,
            ];
          };
        }

        context.report(report);
      },
    };
  },
};

export default rule;
