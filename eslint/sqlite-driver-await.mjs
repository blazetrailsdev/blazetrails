/**
 * ESLint rule: sqlite-driver-await
 *
 * Flags `driver.<method>(...)` call sites — where `driver` is a local
 * identifier (variable or parameter) — that are not wrapped in `await` or
 * chained with `.then()` / `.catch()` / `.finally()`.  The SqliteDriver interface returns
 * `T | Promise<T>` so that the same surface can back both the current
 * synchronous better-sqlite3 implementation and a future async driver.  A
 * forgotten `await` silently discards the Promise when the async path is
 * enabled — this rule turns that into a lint-time (CI) error.
 *
 * `this.driver.<method>()` is excluded: those call sites use `this` as the
 * receiver and are covered by the TypeScript compiler once return types
 * move to `Promise<T>`.
 *
 * No SqliteDriver methods are unconditionally synchronous — every callable
 * member returns `T | Promise<T>`.  Property accesses (`driver.raw`,
 * `driver.open`) are never CallExpressions and therefore never matched.
 *
 * Scoped to sqlite3/** and sqlite3-adapter.ts only (see eslint.config.mjs).
 */

/**
 * @internal
 * Strip TS-only and parenthesized wrapper expressions that don't change the
 * runtime value: non-null assertion (`x!`), type assertions (`x as T`,
 * `<T>x`), satisfies (`x satisfies T`), and parenthesized expressions.
 * Without unwrapping, forms like `driver!.run(...)` or
 * `(driver as SqliteDriver).run(...)` would silently bypass the rule.
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

/**
 * @internal
 * Returns true when `node` (a CallExpression whose callee is `driver.<method>`)
 * is safely consumed — either awaited or chained with .then/.catch/.finally.
 * Walks up through transparent wrapper nodes (parentheses, TS assertions) so
 * that `await (driver.run(...))` is correctly recognised as safe.
 */
function isSafelyConsumed(node) {
  let ancestor = node.parent;
  // Walk up through transparent wrappers (e.g. parenthesized expressions).
  while (
    ancestor &&
    (ancestor.type === "ParenthesizedExpression" ||
      ancestor.type === "TSNonNullExpression" ||
      ancestor.type === "TSAsExpression" ||
      ancestor.type === "TSTypeAssertion" ||
      ancestor.type === "TSSatisfiesExpression")
  ) {
    ancestor = ancestor.parent;
  }
  if (!ancestor) return false;
  // await driver.foo()  /  await (driver.foo())
  if (ancestor.type === "AwaitExpression") return true;
  // driver.foo().then(...) / .catch(...) / .finally(...)
  // The immediate parent of the original node must still be the MemberExpression
  // callee — don't allow wrappers between the call and the chain accessor.
  const parent = node.parent;
  if (
    parent &&
    parent.type === "MemberExpression" &&
    parent.object === node &&
    parent.property.type === "Identifier" &&
    (parent.property.name === "then" ||
      parent.property.name === "catch" ||
      parent.property.name === "finally") &&
    parent.parent?.type === "CallExpression" &&
    parent.parent.callee === parent
  ) {
    return true;
  }
  return false;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require await (or .then chain) on sqlite driver calls — interface returns T | Promise<T>.",
    },
    schema: [],
    messages: {
      missingAwait:
        "sqlite driver call must be awaited (interface returns T | Promise<T>); add 'await' or chain '.then'/'.catch'/'.finally'.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        // Unwrap TS wrappers on the object so `driver!.run()` and
        // `(driver as SqliteDriver).run()` are caught alongside plain `driver.run()`.
        const obj = unwrap(callee.object);
        if (!obj || obj.type !== "Identifier" || obj.name !== "driver") return;
        const method = callee.property;
        if (method.type !== "Identifier") return;
        if (isSafelyConsumed(node)) return;
        context.report({ node, messageId: "missingAwait" });
      },
    };
  },
};

export default rule;
