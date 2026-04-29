/**
 * ESLint rule: rails-private-jsdoc
 *
 * Requires `@internal` JSDoc on TS declarations whose Rails counterpart
 * is private/protected on every host that defines the same method name
 * in the same Ruby source file. The website's TypeDoc build runs with
 * `excludeInternal: true`, so the tag keeps Rails-private surface out
 * of the generated API reference.
 *
 * The "all-private" guard means a name shared with a public Rails host
 * (e.g. ActiveModel::Attributes#attribute is private but
 * ActiveModel::Attributes::ClassMethods#attribute is public) is left
 * alone — public on any sibling host wins.
 *
 * Manifest is generated from rails-api.json:
 *   pnpm tsx scripts/build-rails-privates-manifest.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, "rails-private-methods.json");

let manifestCache = null;
function loadManifest() {
  if (manifestCache) return manifestCache;
  if (!fs.existsSync(MANIFEST_PATH)) {
    manifestCache = {};
    return manifestCache;
  }
  manifestCache = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  return manifestCache;
}

function relFromRepoRoot(filename) {
  // The lint config runs from repo root — context.filename is absolute.
  // Strip a leading repo path so manifest keys (repo-relative) match.
  // Walk up until we find the repo root marker (pnpm-workspace.yaml).
  let dir = path.dirname(filename);
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.relative(dir, filename);
    }
    dir = path.dirname(dir);
  }
  return filename;
}

function jsdocHasInternal(node, sourceCode) {
  const comments = sourceCode.getCommentsBefore(node);
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c.type !== "Block") continue;
    if (!c.value.startsWith("*")) continue;
    return { tag: c.value.includes("@internal"), comment: c };
  }
  return { tag: false, comment: null };
}

function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1] : "";
}

function fixerInsertInternal(fixer, node, sourceCode, jsdocComment) {
  if (jsdocComment) {
    // Insert ` * @internal` immediately before closing `*/`.
    const text = sourceCode.getText().slice(jsdocComment.range[0], jsdocComment.range[1]);
    const closeIdx = text.lastIndexOf("*/");
    const beforeClose = text.slice(0, closeIdx);
    // Determine indent from the line containing the closing `*/`.
    const lineNum = jsdocComment.loc.end.line;
    const lineText = sourceCode.lines[lineNum - 1] ?? "";
    const indent = indentOf(lineText);
    const trimmed = beforeClose.replace(/[ \t]*$/, "");
    const trimmedEndsWithBlank = /(?:^|\n)\s*\*\s*$/.test(trimmed);
    const insertion = trimmedEndsWithBlank
      ? `* @internal\n${indent}`
      : `*\n${indent}* @internal\n${indent}`;
    return fixer.replaceTextRange(
      [jsdocComment.range[0], jsdocComment.range[1]],
      beforeClose + insertion + "*/",
    );
  }
  // Fresh JSDoc above the node.
  const startLine = node.loc.start.line;
  const lineText = sourceCode.lines[startLine - 1] ?? "";
  const indent = indentOf(lineText);
  return fixer.insertTextBeforeRange(node.range, `/** @internal */\n${indent}`);
}

function check(context, node, name) {
  if (!name) return;
  // For autofix + comment lookup, use the outer ExportNamedDeclaration
  // when present so we insert *before* `export` rather than between
  // `export` and `function`.
  const target = node.parent && node.parent.type === "ExportNamedDeclaration" ? node.parent : node;
  const filename = context.filename ?? context.getFilename?.();
  if (!filename) return;
  const rel = relFromRepoRoot(filename);
  const manifest = loadManifest();
  const names = manifest[rel];
  if (!names || !names.includes(name)) return;

  const sourceCode = context.sourceCode ?? context.getSourceCode();
  const { tag, comment } = jsdocHasInternal(target, sourceCode);
  if (tag) return;

  context.report({
    node: target,
    messageId: "missingInternal",
    data: { name },
    fix(fixer) {
      return fixerInsertInternal(fixer, target, sourceCode, comment);
    },
  });
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `@internal` JSDoc on TS declarations whose Rails counterpart is private/protected.",
    },
    fixable: "code",
    schema: [],
    messages: {
      missingInternal:
        "`{{name}}` is private/protected in Rails. Add a `@internal` JSDoc tag so it stays out of the website API reference.",
    },
  },
  create(context) {
    return {
      // export function foo() {} — top-level only
      "Program > ExportNamedDeclaration > FunctionDeclaration"(node) {
        check(context, node, node.id?.name);
      },
      "Program > FunctionDeclaration"(node) {
        check(context, node, node.id?.name);
      },
      // class members: methods, getters/setters, property assignments.
      "ClassBody > MethodDefinition"(node) {
        if (node.key?.type !== "Identifier") return;
        if (node.accessibility === "private" || node.accessibility === "protected") return;
        check(context, node, node.key.name);
      },
      "ClassBody > PropertyDefinition"(node) {
        if (node.key?.type !== "Identifier") return;
        if (node.accessibility === "private" || node.accessibility === "protected") return;
        check(context, node, node.key.name);
      },
    };
  },
};

export default rule;
