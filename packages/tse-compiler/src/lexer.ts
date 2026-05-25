/** TSE lexer. Rails analogue: the `erubi` gem scanner. Single divergence:
 * `<%! ... !%>` magic blocks for TS-only type annotations (plan §2.10.1). */

export type TokenKind =
  | "text"
  | "code"
  | "expr"
  | "blockExpr"
  | "rawExpr"
  | "comment"
  | "typesMagic";

/** Mirrors Erubi's BLOCK_EXPR: expression ends with a block opener so the
 * emitter must not wrap it in parens — the trailing block would be cut off. */
const BLOCK_EXPR_RE = /((\s|\))do|\{)(\s*\|[^|]*\|)?\s*$/;
export interface Token {
  kind: TokenKind;
  value: string;
  trimLeft: boolean;
  trimRight: boolean;
  /** 0-indexed line number in the original `.tse` source. */
  srcLine: number;
}
export class TseSyntaxError extends Error {}

const TAG_RE = /<%%|%%>|<%!([\s\S]*?)!%>|<%(-)?(==|=|#)?([\s\S]*?)(-)?%>/g;
const KIND: Record<string, TokenKind> = { "=": "expr", "==": "rawExpr", "#": "comment" };

function buildLineIndex(source: string): (offset: number) => number {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }
  return (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (lineStarts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
}

const text = (value: string, srcLine: number): Token => ({
  kind: "text",
  value,
  trimLeft: false,
  trimRight: false,
  srcLine,
});

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lineAt = buildLineIndex(source);
  let buf = "";
  let last = 0;
  let bufStartOffset = 0;
  const flush = (): void => {
    if (buf.length > 0) tokens.push(text(buf, lineAt(bufStartOffset)));
    buf = "";
  };

  for (const m of source.matchAll(TAG_RE)) {
    if (buf.length === 0) bufStartOffset = last;
    buf += source.slice(last, m.index);
    last = m.index + m[0].length;
    if (m[0] === "<%%") buf += "<%";
    else if (m[0] === "%%>") buf += "%>";
    else if (m[1] !== undefined) {
      flush();
      tokens.push({
        kind: "typesMagic",
        value: m[1],
        trimLeft: false,
        trimRight: false,
        srcLine: lineAt(m.index),
      });
    } else {
      const trimLeft = m[2] === "-";
      const trimRight = m[5] === "-";
      if (trimLeft) buf = buf.replace(/[ \t]*$/, "");
      flush();
      const baseKind = KIND[m[3] ?? ""] ?? "code";
      const kind: TokenKind =
        baseKind === "expr" && BLOCK_EXPR_RE.test(m[4] ?? "") ? "blockExpr" : baseKind;
      tokens.push({ kind, value: m[4], trimLeft, trimRight, srcLine: lineAt(m.index) });
      if (trimRight) last += (/^[ \t]*\r?\n/.exec(source.slice(last))?.[0] ?? "").length;
    }
    bufStartOffset = last;
  }
  buf += source.slice(last);
  flush();

  if (/<%/.test(source.replace(TAG_RE, ""))) throw new TseSyntaxError("unterminated TSE tag");
  return tokens;
}
