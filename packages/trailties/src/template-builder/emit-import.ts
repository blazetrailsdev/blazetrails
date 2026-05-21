import type { Import, ImportResult, Ref } from "./types.js";
import { ref } from "./refs.js";

export function tsImport<TNames extends string>(
  from: string,
  names: Record<TNames, string | "named">,
): ImportResult<TNames> {
  const named: Record<string, string> = {};
  const refs: Record<string, Ref> = {};
  for (const alias in names) {
    const v = names[alias];
    named[alias] = v === "named" ? alias : (v as string);
    refs[alias] = ref(alias, from);
  }
  return { import: { from, named }, refs: refs as { [K in TNames]: Ref } };
}

export function tsImportDefault<TName extends string>(
  from: string,
  name: TName,
): ImportResult<TName> {
  return {
    import: { from, default: name },
    refs: { [name]: ref(name, from) } as { [K in TName]: Ref },
  };
}

export function tsImportType<TNames extends string>(
  from: string,
  names: Record<TNames, string | "named">,
): ImportResult<TNames> {
  const r = tsImport(from, names);
  r.import.typeOnly = true;
  return r;
}

export function emitImport(imp: Import): string {
  const parts: string[] = [];
  if (imp.default) parts.push(imp.default);
  const keys = imp.named ? Object.keys(imp.named) : [];
  if (keys.length) {
    const entries = keys
      .sort((a, b) => a.localeCompare(b))
      .map((a) => {
        const o = imp.named![a];
        return a === o ? a : `${o} as ${a}`;
      });
    parts.push(`{ ${entries.join(", ")} }`);
  }
  if (!parts.length) {
    throw new Error(`Import from "${imp.from}" has no default or named bindings`);
  }
  return `${imp.typeOnly ? "import type" : "import"} ${parts.join(", ")} from "${imp.from}";`;
}

export function mergeImports(imports: Import[]): Import[] {
  const map = new Map<string, Import>();
  for (const imp of imports) {
    const key = `${imp.typeOnly ? "t:" : ""}${imp.from}`;
    const e = map.get(key);
    if (!e) {
      map.set(key, {
        from: imp.from,
        typeOnly: imp.typeOnly,
        default: imp.default,
        named: imp.named ? { ...imp.named } : undefined,
      });
    } else {
      if (imp.default && !e.default) e.default = imp.default;
      if (imp.named) e.named = { ...(e.named ?? {}), ...imp.named };
    }
  }
  return [...map.values()].sort((a, b) => a.from.localeCompare(b.from));
}
