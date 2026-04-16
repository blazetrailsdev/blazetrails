# Virtualized DX type tests

Parallel to `../dx-tests/` but authored in the **zero-declare / zero-import**
form. Model classes are written as pure Rails-style static blocks:

```ts
class Post extends Base {
  static {
    this.attribute("title", "string");
    this.belongsTo("author");
  }
}
```

No `declare` fields, no `import type { Author }` — `trails-tsc` injects both
at compile time. Plain `tsc` will fail to compile these files; that's the
whole point of the virtualizer.

Run locally:

```bash
pnpm test:types:virtualized
```

CI runs the same command in the `Virtualized DX Type Tests` job.

The companion file `../dx-tests/declare-patterns.test-d.ts` is the manual
escape hatch — useful when a model needs a type declaration the virtualizer
doesn't produce yet, or to document the shape for reference.
