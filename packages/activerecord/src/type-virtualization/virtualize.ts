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
    text = text.slice(0, insertPos) + importBlock + text.slice(insertPos);
    // Shift all existing deltas down by the number of prepended lines.
    const prependedLines = prependImports.length;
    for (const d of deltas) {
      d.insertedAtLine += prependedLines;
    }
    // Use insertedAtLine: -1 so remapLine correctly treats virtual
    // lines 0..prependedLines-1 as "inside the injected range" (null)
    // and virtual line prependedLines as original line 0.
    deltas.unshift({ insertedAtLine: -1, lineCount: prependedLines });
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
  let pos = 0;
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (
      trimmed.startsWith("#!") ||
      trimmed.startsWith("/// <") ||
      trimmed.startsWith("// @ts-") ||
      trimmed.startsWith("/* @ts-") ||
      trimmed === ""
    ) {
      pos += line.length + 1; // +1 for \n
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
