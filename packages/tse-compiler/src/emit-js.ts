/** JS runtime emitter — TseAst → ES module. Mirrors actionview-flavored Erubi
 * (plan §2.6): static text → `safeAppend`; `<%= %>` → `append` (escapes unless
 * SafeString) or `safeExprAppend` when format is in `escape_ignore_list`;
 * `<%== %>` always `safeExprAppend`. */

import { parse, type TseAst, type TseNode } from "./parser.js";

export interface EmitJsOptions {
  escapeIgnore?: boolean;
}

export interface EmitResult {
  code: string;
  localsSignature: string | null;
  typesAnnotation: string | null;
}

export function compileJs(source: string, options: EmitJsOptions = {}): EmitResult {
  const ast = parse(source);
  return {
    code: emit(ast, options),
    localsSignature: ast.localsSignature,
    typesAnnotation: ast.typesAnnotation,
  };
}

/** Matches `<% } %>` / `<% }) %>` closers that can terminate an open blockExpr. */
const BLOCK_CLOSE_RE = /^\s*\}\s*\)?\s*;?\s*$/;
/** Matches code tags that open a nested brace inside a blockExpr body. */
const INNER_OPEN_RE = /\{\s*$/;

function emit(ast: TseAst, options: EmitJsOptions): string {
  const exprAppend = options.escapeIgnore === true ? "safeExprAppend" : "append";
  const lines = [
    "export default function render(context, locals) {",
    "  const _ob = context.outputBuffer;",
  ];
  // Stack: one entry per open blockExpr, tracking unclosed code `{` inside it.
  const innerDepths: number[] = [];
  for (const node of ast.nodes) {
    if (node.kind === "blockExpr") {
      innerDepths.push(0);
      lines.push(`  _ob.${exprAppend}(${node.value.trim()}`);
    } else if (node.kind === "code" && innerDepths.length > 0) {
      const innerDepth = innerDepths[innerDepths.length - 1]!;
      if (BLOCK_CLOSE_RE.test(node.value) && innerDepth === 0) {
        innerDepths.pop();
        const t = node.value.trim();
        lines.push(`  ${t.endsWith(";") ? t.slice(0, -1) : t});`);
      } else {
        if (INNER_OPEN_RE.test(node.value)) innerDepths[innerDepths.length - 1]!++;
        else if (BLOCK_CLOSE_RE.test(node.value)) innerDepths[innerDepths.length - 1]!--;
        lines.push("  " + emitNode(node, exprAppend));
      }
    } else {
      lines.push("  " + emitNode(node, exprAppend));
    }
  }
  lines.push("  return _ob;", "}");
  return lines.join("\n") + "\n";
}

function emitNode(node: TseNode, exprAppend: string): string {
  switch (node.kind) {
    case "text":
      return `_ob.safeAppend(${JSON.stringify(node.value)});`;
    case "code": {
      const t = node.value.trimEnd();
      return node.value + (t.endsWith(";") || t.endsWith("{") || t.endsWith("}") ? "" : ";");
    }
    case "expr":
      return `_ob.${exprAppend}(${node.value});`;
    case "rawExpr":
      return `_ob.safeExprAppend(${node.value});`;
    case "blockExpr":
      return `_ob.${exprAppend}(${node.value}`;
  }
}
