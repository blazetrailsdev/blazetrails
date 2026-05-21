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
import type { LineDelta, TscPlugin, VirtualizeOutput } from "../plugin.js";

export class TseLocalsSignatureError extends Error {}

interface LocalEntry {
  name: string;
  defaultExpr: string | null;
}

/**
 * Parse the body of `<%# locals: (...) %>` into entries. The grammar
 * matches Rails' kwarg form: `name:` (required) and `name: default`
 * (optional). Defaults can contain commas inside parens/brackets/braces
 * and string/template literals, so we split on top-level commas only,
 * tracking bracket depth and quote state. Generics (`Foo<A, B>`) are
 * NOT recognized — angle brackets are ambiguous with `<` comparisons
 * without a full TS scanner; same class of pragmatic limit as Erubi's
 * regex lexer (plan §2.10.1). Template authors with generic defaults
 * should bind via a name (`const x = foo<A, B>(); … count: x`).
 */
function parseLocalsSignature(sig: string): LocalEntry[] {
  if (sig === "**nil" || sig.trim() === "") return [];
  const parts: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let buf = "";
  for (let i = 0; i < sig.length; i++) {
    const ch = sig[i]!;
    if (quote !== null) {
      buf += ch;
      if (ch === "\\" && i + 1 < sig.length) {
        buf += sig[i + 1]!;
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      buf += ch;
      continue;
    }
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
    if (colon === -1) {
      throw new TseLocalsSignatureError(
        `malformed locals entry ${JSON.stringify(trimmed)} — expected \`name:\` or \`name: default\``,
      );
    }
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
  // `Record<never, never>` collapses to `{}` (any object assignable),
  // so use `Record<string, never>` — every key must map to `never`,
  // which makes any provided property a type error.
  if (locals.length === 0) return "Record<string, never>";
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

export interface VirtualizeTseResult {
  ts: string;
  deltas: readonly LineDelta[];
}

export function virtualizeTse(source: string): string {
  return virtualizeTseWithDeltas(source).ts;
}

export function virtualizeTseWithDeltas(source: string): VirtualizeTseResult {
  const ast = parse(source);
  const locals = ast.localsSignature === null ? [] : parseLocalsSignature(ast.localsSignature);
  const localsType = localsParamType(ast, locals);

  const header: string[] = [
    PREAMBLE,
    "export default function render(",
    "  context: RenderContext,",
    `  locals: ${localsType},`,
    "): SafeString {",
    "  void context; void locals;",
    "  const _ob = context.outputBuffer;",
  ];
  const destruct = destructureLine(locals);
  if (destruct !== "") header.push(destruct);
  const body: string[] = [];
  for (const node of ast.nodes) body.push(emitNode(node));
  const footer = ["  return _ob;", "}", ""];

  // The entire header is prepended scaffolding the user didn't write;
  // report it as a single LineDelta at the head of the virtualized
  // file so `remapDiagnostics` subtracts it when surfacing tsc errors
  // at `.tse` coordinates. Body lines are 1:1 with `<%= %>`/`<% %>`
  // tokens; per-node line-precise mapping is a follow-up tied to
  // tse-compiler emitting token spans.
  const ts = [...header, ...body, ...footer].join("\n");
  const headerLineCount = header.join("\n").split("\n").length;
  const deltas: LineDelta[] = [{ insertedAtLine: -1, lineCount: headerLineCount }];
  return { ts, deltas };
}

export function createTsePlugin(): TscPlugin {
  return {
    name: "tse",
    extensions: [".tse"],
    virtualize(_filePath, source): VirtualizeOutput {
      const { ts, deltas } = virtualizeTseWithDeltas(source);
      return { ts, deltas };
    },
  };
}
