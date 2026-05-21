import type { ClassDecl, ClassOpts, Field, Ref } from "./types.js";
import { emitField, emitMethod, isMethod } from "./emit-method.js";
import { refMeta } from "./refs.js";

export function tsClass(opts: ClassOpts): ClassDecl {
  return { __kind: "class", exported: true, ...opts } as unknown as ClassDecl;
}

export function emitClass(c: ClassDecl): { text: string; refs: Ref[] } {
  const refs: Ref[] = [];
  let ext = "";
  if (c.extends) {
    refs.push(c.extends);
    ext = ` extends ${refMeta(c.extends).name}`;
  }
  let impl = "";
  if (c.implements?.length) {
    impl = ` implements ${c.implements
      .map((r) => {
        refs.push(r);
        return refMeta(r).name;
      })
      .join(", ")}`;
  }
  const members: string[] = [];
  for (const m of c.body) {
    if (isMethod(m)) {
      const e = emitMethod(m);
      refs.push(...e.refs);
      members.push(e.text);
    } else {
      const e = emitField(m as Field);
      refs.push(...e.refs);
      members.push(`  ${e.text}`);
    }
  }
  return {
    text: `${c.exported !== false ? "export " : ""}class ${c.name}${ext}${impl} {\n${members.join("\n\n")}\n}`,
    refs,
  };
}
