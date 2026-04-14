# DX type tests

Type-level tests for `@blazetrails/activerecord` that exercise the public
API the way a Rails developer would use it. They answer: **can someone
build a Rails app on top of this with good autocomplete and type safety?**

These are NOT runtime tests. They use Vitest's typecheck mode (`*.test-d.ts`)
and assert types with `expectTypeOf` / `assertType`. Failures here mean the
published types lie to users.

Run locally:

```bash
pnpm test:types
```

CI runs the same command in a dedicated `DX Type Tests` job.

Each file covers a real-world usage scenario:

- `basic-crud.test-d.ts` — defining a model, creating, reading, updating, destroying
- `associations.test-d.ts` — `belongsTo` / `hasMany` / `hasOne` shapes
- `query-chaining.test-d.ts` — `where` / `order` / `limit` / thenable chains
- `edge-cases.test-d.ts` — rough edges where today's types still return `any`
