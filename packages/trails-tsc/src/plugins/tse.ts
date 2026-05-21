/**
 * TSE virtualization plugin. Maps `.tse` source files to a typed TS
 * function so tsc can type-check `<%= expr %>` and `<% code %>` blocks
 * against the locals declared in `<%# locals: (...) %>` / refined by
 * `<%! types: { ... } !%>`.
 *
 * Phase 2b scope: a single virtualized TS string per file (the
 * `.tse.ts` body). On-disk `.tse.d.ts` / `.tse.js` emission is Phase
 * 2c (build CLI). The body declares `RenderContext` and `SafeString`
 * inline so this plugin has no actionview dependency.
 *
 * Plan: docs/tse-plan.md §2 + §4 (Phase 2b).
 */

import { parse, type TseAst } from "@blazetrails/tse-compiler";
import type { TscPlugin, VirtualizeOutput } from "../plugin.js";

interface LocalEntry {
  name: string;
  defaultExpr: string | null;
}

/**
 * Parse the body of `<%# locals: (...) %>` into entries. The grammar
 * matches Rails' kwarg form: `name:` (required) and `name: default`
 * (optional). Defaults can contain commas inside parens/brackets/braces,
 * so we split on top-level commas only.
 */
function parseLocalsSignature(sig: string): LocalEntry[] {
  if (sig === "**nil" || sig.trim() === "") return [];
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of sig) {
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    buf += ch;
  }
  if (buf.trim() !== "") parts.push(buf);

  const entries: LocalEntry[] = [];
  for (const raw of parts) {
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const name = trimmed.slice(0, colon).trim();
    const tail = trimmed.slice(colon + 1).trim();
    entries.push({ name, defaultExpr: tail === "" ? null : tail });
  }
  return entries;
}

function localsParamType(ast: TseAst, locals: LocalEntry[]): string {
  if (ast.typesAnnotation !== null) return ast.typesAnnotation;
  // No `<%# locals: %>` at all → permissive default.
  if (ast.localsSignature === null) return "Record<string, unknown>";
  // Explicit empty `<%# locals: () %>` → reject any keys (Rails `**nil`).
  if (locals.length === 0) return "Record<never, never>";
  const fields = locals.map((l) => `${l.name}${l.defaultExpr ? "?" : ""}: unknown`);
  return `{ ${fields.join("; ")} }`;
}

function destructureLine(locals: LocalEntry[]): string {
  if (locals.length === 0) return "";
  const pieces = locals.map((l) =>
    l.defaultExpr === null ? l.name : `${l.name} = ${l.defaultExpr}`,
  );
  return `  const { ${pieces.join(", ")} } = locals;`;
}

function emitNode(node: TseAst["nodes"][number]): string {
  switch (node.kind) {
    case "text":
      return `  _ob.safeAppend(${JSON.stringify(node.value)});`;
    case "code": {
      const t = node.value.trimEnd();
      const needsSemi = !(t.endsWith(";") || t.endsWith("{") || t.endsWith("}"));
      return `  ${node.value}${needsSemi ? ";" : ""}`;
    }
    case "expr":
      return `  _ob.append(${node.value});`;
    case "rawExpr":
      return `  _ob.safeExprAppend(${node.value});`;
  }
}

const PREAMBLE = [
  "/* virtualized from .tse — phase 2b trails-tsc plugin */",
  "interface SafeString { readonly __safeStringBrand: unique symbol }",
  "interface OutputBuffer extends SafeString {",
  "  safeAppend(s: string): void;",
  "  append(value: unknown): void;",
  "  safeExprAppend(value: unknown): void;",
  "}",
  "interface RenderContext {",
  "  readonly outputBuffer: OutputBuffer;",
  "  [key: string]: unknown;",
  "}",
  "",
].join("\n");

export function virtualizeTse(source: string): string {
  const ast = parse(source);
  const locals = ast.localsSignature === null ? [] : parseLocalsSignature(ast.localsSignature);
  const localsType = localsParamType(ast, locals);

  const lines: string[] = [
    PREAMBLE,
    "export default function render(",
    "  context: RenderContext,",
    `  locals: ${localsType},`,
    "): SafeString {",
    "  void context; void locals;",
    "  const _ob = context.outputBuffer;",
  ];
  const destruct = destructureLine(locals);
  if (destruct !== "") lines.push(destruct);
  for (const node of ast.nodes) lines.push(emitNode(node));
  lines.push("  return _ob;", "}", "");
  return lines.join("\n");
}

export function createTsePlugin(): TscPlugin {
  return {
    name: "tse",
    extensions: [".tse"],
    virtualize(_filePath, source): VirtualizeOutput {
      return { ts: virtualizeTse(source) };
    },
  };
}
