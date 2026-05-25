/** V3 source map generator — line-level mappings, no external deps. */

const VLQ_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeVlq(value: number): string {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
  let out = "";
  do {
    let digit = vlq & 0x1f;
    vlq >>>= 5;
    if (vlq > 0) digit |= 0x20;
    out += VLQ_CHARS[digit];
  } while (vlq > 0);
  return out;
}

export interface LineMapping {
  /** 0-indexed line in the generated output. */
  genLine: number;
  /** 0-indexed line in the original source. */
  srcLine: number;
}

export interface RawSourceMap {
  version: 3;
  file: string;
  sourceRoot: string;
  sources: string[];
  sourcesContent: (string | null)[];
  mappings: string;
}

export function generateSourceMap(
  file: string,
  sourceFile: string,
  sourceContent: string | null,
  mappings: readonly LineMapping[],
): RawSourceMap {
  const sorted = [...mappings].sort((a, b) => a.genLine - b.genLine);
  const lineSegments: string[] = [];
  let prevGenLine = 0;
  let prevSrcLine = 0;
  let prevSrcIdx = 0;

  for (const m of sorted) {
    while (prevGenLine < m.genLine) {
      lineSegments.push("");
      prevGenLine++;
    }
    const seg =
      encodeVlq(0) + encodeVlq(0 - prevSrcIdx) + encodeVlq(m.srcLine - prevSrcLine) + encodeVlq(0);
    prevSrcIdx = 0;
    prevSrcLine = m.srcLine;
    lineSegments.push(seg);
    prevGenLine++;
  }

  return {
    version: 3,
    file,
    sourceRoot: "",
    sources: [sourceFile],
    sourcesContent: [sourceContent],
    mappings: lineSegments.join(";"),
  };
}
