import type { Import, ModuleSource, RawDecl, Ref } from "./types.js";
import { emitClass } from "./emit-class.js";
import { emitInterface } from "./emit-interface.js";
import { emitImport, mergeImports } from "./emit-import.js";
import { refMeta } from "./refs.js";

export function tsRaw(text: string): RawDecl {
  return { __kind: "raw", text };
}

export function tsModule(src: ModuleSource): string {
  const valueRefs: Ref[] = [];
  const typeRefs: Ref[] = [];
  const declTexts: string[] = [];
  for (const d of src.declarations) {
    switch (d.__kind) {
      case "class": {
        const e = emitClass(d);
        valueRefs.push(...e.valueRefs);
        typeRefs.push(...e.typeRefs);
        declTexts.push(e.text);
        break;
      }
      case "interface": {
        const e = emitInterface(d);
        valueRefs.push(...e.valueRefs);
        typeRefs.push(...e.typeRefs);
        declTexts.push(e.text);
        break;
      }
      case "raw":
        declTexts.push(d.text);
        break;
    }
  }
  const explicit = src.imports ?? [];
  // Per-(from,alias) coverage built from explicit imports — split by
  // typeOnly so a value-side reference still triggers a value import even
  // when the caller already declared a type-only import for that symbol.
  const valueCovered = new Set<string>();
  const typeCovered = new Set<string>();
  for (const imp of explicit) {
    const set = imp.typeOnly ? typeCovered : valueCovered;
    if (imp.default) set.add(`${imp.from}|${imp.default}`);
    for (const alias of Object.keys(imp.named ?? {})) set.add(`${imp.from}|${alias}`);
  }
  // Value uses always create (or are covered by) a value import.
  const fromRefs: Import[] = [];
  const usedAsValue = new Set<string>();
  for (const r of valueRefs) {
    const m = refMeta(r);
    if (!m.from) continue;
    usedAsValue.add(`${m.from}|${m.name}`);
    if (valueCovered.has(`${m.from}|${m.name}`)) continue;
    fromRefs.push({ from: m.from, named: { [m.name]: m.name } });
    valueCovered.add(`${m.from}|${m.name}`);
  }
  // Type-only uses get an `import type` line, but only if the binding
  // isn't already imported (as value or type) and isn't used as a value
  // anywhere in this module.
  for (const r of typeRefs) {
    const m = refMeta(r);
    if (!m.from) continue;
    const key = `${m.from}|${m.name}`;
    if (usedAsValue.has(key)) continue;
    if (valueCovered.has(key) || typeCovered.has(key)) continue;
    fromRefs.push({ from: m.from, typeOnly: true, named: { [m.name]: m.name } });
    typeCovered.add(key);
  }
  const merged = mergeImports([...fromRefs, ...explicit]);
  const importBlock = merged.map(emitImport).join("\n");
  const pre = src.preamble ? `${src.preamble}\n\n` : "";
  const imp = importBlock ? `${importBlock}\n\n` : "";
  return `${pre}${imp}${declTexts.join("\n\n")}\n`;
}
