/**
 * ESLint rule: no-native-date
 *
 * Disallows JavaScript `Date` *value* usage in domain code. Use `Temporal`
 * types (Instant / PlainDate / PlainDateTime / PlainTime / ZonedDateTime)
 * instead.
 *
 * Honors two escape-hatch markers:
 *   - File-level: a JSDoc block containing `@boundary-file:` in the file's
 *     leading comments (entire file is exempt).
 *   - Line-level: a `boundary:` keyword in a comment on the same line as
 *     the offending construct OR on the immediately-preceding comment line.
 *
 * Detected constructs:
 *   - `new Date(...)`
 *   - `x instanceof Date`
 *
 * Out of scope (return `number` or live in type position only):
 *   - `Date.now()` / `Date.parse(...)` / `Date.UTC(...)` — produce numbers,
 *     not propagating Date values.
 *   - `: Date` type references — constrain flow, don't create Date instances.
 *
 * The rule treats any reference to `Date` as the global only when it doesn't
 * resolve to a local binding (e.g. an `import { Date } from ...` or a class
 * named `Date` in scope), so files that locally rebind the name (such as
 * `activerecord/src/type.ts` importing the AR `Type::Date` class) are
 * naturally exempt.
 */

function hasFileBoundaryDirective(sourceCode) {
  // Scan leading block comments at the top of the file for `@boundary-file:`.
  for (const comment of sourceCode.getAllComments()) {
    if (comment.type !== "Block") continue;
    if (comment.value.includes("@boundary-file:")) return true;
    // Stop scanning once we pass non-leading comments — directives must be
    // in the file header, before any non-comment token.
    if (comment.range[0] > 0) {
      const before = sourceCode.text.slice(0, comment.range[0]);
      if (/[^\s]/.test(before.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""))) {
        return false;
      }
    }
  }
  return false;
}

function hasBoundaryComment(sourceCode, node) {
  const line = node.loc.start.line;
  // Same-line trailing comment.
  for (const comment of sourceCode.getAllComments()) {
    if (comment.loc.start.line === line && /\bboundary:/i.test(comment.value)) {
      return true;
    }
  }
  // Walk up to the enclosing top-level statement (parent is BlockStatement
  // or Program). Comments leading that statement count as boundary markers,
  // and so do comments inside its body before the offending node.
  let stmt = node;
  while (
    stmt &&
    stmt.parent &&
    stmt.parent.type !== "BlockStatement" &&
    stmt.parent.type !== "Program"
  ) {
    stmt = stmt.parent;
  }
  if (!stmt) return false;
  for (const comment of sourceCode.getCommentsBefore(stmt)) {
    if (/\bboundary:/i.test(comment.value)) return true;
  }
  // Also accept comments within the enclosing block but before the offending
  // node (covers multi-line expressions where the marker leads a sibling
  // statement, e.g. `if (...) { /* boundary: */ const x = ...; const y = new Date(); }`).
  const block = stmt.parent;
  if (block && /BlockStatement|Program/.test(block.type)) {
    for (const comment of sourceCode.getAllComments()) {
      if (
        comment.range[0] >= block.range[0] &&
        comment.range[1] <= node.range[1] &&
        /\bboundary:/i.test(comment.value)
      ) {
        return true;
      }
    }
  }
  return false;
}

function isLocallyBoundDate(context, node) {
  // ESLint scope analysis — if `Date` resolves to a local variable, it's not
  // the JS global, so skip.
  const sourceCode = context.sourceCode || context.getSourceCode();
  let scope = sourceCode.getScope(node);
  while (scope) {
    const variable = scope.variables.find((v) => v.name === "Date");
    if (variable && variable.defs.length > 0) return true;
    scope = scope.upper;
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow JavaScript `Date` in domain code; prefer Temporal types. Use `// boundary:` or `@boundary-file:` for documented exemptions.",
    },
    schema: [],
    messages: {
      noNew:
        "Use `Temporal.Instant.fromEpochMilliseconds(...)` or another Temporal constructor instead of `new Date(...)`. Annotate with `// boundary:` if the JS `Date` is intentional.",
      noInstanceof:
        "Use `Temporal` type checks (e.g. `x instanceof Temporal.Instant`) instead of `instanceof Date`. Annotate with `// boundary:` if the JS `Date` is intentional.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    if (hasFileBoundaryDirective(sourceCode)) return {};

    function report(node, messageId, data) {
      if (hasBoundaryComment(sourceCode, node)) return;
      context.report({ node, messageId, data });
    }

    return {
      NewExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "Date" &&
          !isLocallyBoundDate(context, node)
        ) {
          report(node, "noNew");
        }
      },
      BinaryExpression(node) {
        if (
          node.operator === "instanceof" &&
          node.right.type === "Identifier" &&
          node.right.name === "Date" &&
          !isLocallyBoundDate(context, node)
        ) {
          report(node, "noInstanceof");
        }
      },
    };
  },
};

export default rule;
