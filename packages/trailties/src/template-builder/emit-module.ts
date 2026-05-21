import type { ClassDecl, Import, InterfaceDecl, ModuleSource, RawDecl, Ref } from "./types.js";
import { emitClass } from "./emit-class.js";
import { emitInterface } from "./emit-interface.js";
import { emitImport, mergeImports } from "./emit-import.js";
import { refMeta } from "./refs.js";

export function tsModule(src: ModuleSource): string {
  const refs: Ref[] = [];
  const declTexts: string[] = [];
  for (const d of src.declarations) {
    const kind = (d as unknown as { __kind: "class" | "interface" | "raw" }).__kind;
    if (kind === "class") {
      const e = emitClass(d as ClassDecl);
      refs.push(...e.refs);
      declTexts.push(e.text);
    } else if (kind === "interface") {
      const e = emitInterface(d as InterfaceDecl);
      refs.push(...e.refs);
      declTexts.push(e.text);
    } else {
      declTexts.push((d as RawDecl).text);
    }
  }
  const fromRefs: Import[] = [];
  for (const r of refs) {
    const m = refMeta(r);
    if (m.from) fromRefs.push({ from: m.from, named: { [m.name]: m.name } });
  }
  const merged = mergeImports([...(src.imports ?? []), ...fromRefs]);
  const importBlock = merged.map(emitImport).join("\n");
  const pre = src.preamble ? `${src.preamble}\n\n` : "";
  const imp = importBlock ? `${importBlock}\n\n` : "";
  return `${pre}${imp}${declTexts.join("\n\n")}\n`;
}
