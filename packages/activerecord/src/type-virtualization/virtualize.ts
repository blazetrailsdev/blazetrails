// Pure text-transform that turns a user-authored model source into a
// virtualized version with `declare` members spliced into each affected
// class body. No on-disk output; no `ts.Program` or `TypeChecker`
// dependency.
//
// Shells (the trails-tsc CLI and the tsserver plugin) call this and hand
// the result back to the compiler / language service. Tests exercise it
// directly against fixture pairs.

import ts from "typescript";
import { walk, type WalkOptions } from "./walker.js";
import { synthesizeDeclares } from "./synthesize.js";

export interface LineDelta {
  /**
   * 0-indexed line in the VIRTUALIZED text where the injected block
   * begins. The injected range spans
   * `insertedAtLine + 1 .. insertedAtLine + lineCount`, and those
   * virtual lines have no corresponding line in the original source.
   *
   * To map a later virtual line back to the original source,
   * `remapLine` subtracts `lineCount` once the line is after the
   * injected block; deltas are stacked in ascending virtual order so
   * multi-class files and prepended imports compose correctly.
   *
   * The sentinel value `-1` means the block was prepended ABOVE
   * virtual line 0 (used by `prependImports` for auto-imports).
   */
  insertedAtLine: number;
  /** Number of lines the injected block spans. */
  lineCount: number;
}

export interface VirtualizeResult {
  text: string;
  deltas: LineDelta[];
}

export interface VirtualizeOptions extends WalkOptions {
  prependImports?: readonly string[];
}

export function virtualize(
  originalText: string,
  fileName: string,
  options: VirtualizeOptions = {},
): VirtualizeResult {
  const sf = ts.createSourceFile(fileName, originalText, ts.ScriptTarget.ES2022, true);
  const classes = walk(sf, options);

  interface Edit {
    pos: number;
    text: string;
    originalLine: number;
    lineCount: number;
  }
  const edits: Edit[] = [];

  for (const info of classes) {
    if (info.skip) continue;
    if (info.openBracePos < 0) continue;
    const decls = synthesizeDeclares(info);
    if (decls.length === 0) continue;
    const block = "\n" + decls.join("\n") + "\n";
    edits.push({
      pos: info.openBracePos,
      text: block,
      originalLine: sf.getLineAndCharacterOfPosition(info.openBracePos).line,
      lineCount: decls.length + 1, // leading newline + one per decl
    });
  }

  edits.sort((a, b) => b.pos - a.pos);

  let text = originalText;
  for (const e of edits) {
    text = text.slice(0, e.pos) + e.text + text.slice(e.pos);
  }

  // Convert each edit's originalLine into a VIRTUAL line by accumulating
  // the lineCount of all earlier injections. `remapLine` expects
  // `insertedAtLine` to be a virtual coordinate so multi-class files
  // (two injected declare blocks) remap correctly for lines after the
  // second block.
  const sortedEdits = edits.slice().sort((a, b) => a.originalLine - b.originalLine);
  let cumulative = 0;
  const deltas: LineDelta[] = sortedEdits.map((e) => {
    const d: LineDelta = { insertedAtLine: e.originalLine + cumulative, lineCount: e.lineCount };
    cumulative += e.lineCount;
    return d;
  });

  // Insert auto-imported `import type` lines AFTER any leading
  // directives (shebangs, triple-slash refs, @ts-nocheck) that must
  // stay at the top of the file. Erased at runtime (type-only).
  const prependImports = options.prependImports;
  if (prependImports && prependImports.length > 0) {
    const importBlock = prependImports.join("\n") + "\n";
    const insertPos = findDirectiveEnd(text);
    // Compute the virtual line BEFORE which the import block is
    // inserted: `-1` if the block is truly at the start of the file,
    // otherwise the line index of the last directive/blank line that
    // precedes the insertion point. This preserves `remapLine` for
    // any leading directives (shebang / @ts-nocheck / triple-slash).
    const insertedAtLine =
      insertPos === 0 ? -1 : text.slice(0, insertPos).split(/\r?\n/).length - 2;
    text = text.slice(0, insertPos) + importBlock + text.slice(insertPos);
    const prependedLines = prependImports.length;
    for (const d of deltas) {
      d.insertedAtLine += prependedLines;
    }
    deltas.unshift({ insertedAtLine, lineCount: prependedLines });
  }

  return { text, deltas };
}

/**
 * Find the character offset AFTER any leading directives that must
 * stay at the top of the file: shebangs (`#!`), triple-slash refs
 * (`/// <reference ...>`), and TS comment directives (`// @ts-nocheck`
 * etc.). Auto-imports are inserted at this offset so they don't break
 * file-leading semantics.
 */
function findDirectiveEnd(text: string): number {
  // Scan line-by-line preserving the actual line terminator width
  // (`\n` or `\r\n`) so the returned offset is a valid index in
  // `text`. Stops at the first non-directive, non-blank line; also
  // stops if the file ends without a trailing newline so we never
  // overshoot `text.length`.
  const lineRe = /([^\r\n]*)(\r?\n|$)/g;
  let pos = 0;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(text)) !== null) {
    const [full, line, terminator] = match;
    if (terminator === "" && line === "") break;
    const trimmed = line!.trimStart();
    if (
      trimmed.startsWith("#!") ||
      trimmed.startsWith("/// <") ||
      trimmed.startsWith("// @ts-") ||
      trimmed.startsWith("/* @ts-") ||
      trimmed === ""
    ) {
      pos += full!.length;
      if (terminator === "") break;
    } else {
      break;
    }
  }
  return pos;
}

/**
 * Given a line number in the virtualized text, returns the corresponding
 * line in the ORIGINAL source — or `null` if the position is inside an
 * injected block.
 */
export function remapLine(virtualLine: number, deltas: readonly LineDelta[]): number | null {
  let line = virtualLine;
  for (let i = deltas.length - 1; i >= 0; i--) {
    const d = deltas[i];
    if (!d) continue;
    const injectedStart = d.insertedAtLine;
    const injectedEnd = d.insertedAtLine + d.lineCount;
    if (line > injectedEnd) {
      line -= d.lineCount;
    } else if (line > injectedStart && line <= injectedEnd) {
      return null;
    }
  }
  return line;
}
