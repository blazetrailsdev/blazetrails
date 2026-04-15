# Plan: Auto-Typed Models via tsserver Plugin + Generated `.d.ts`

Status: **proposal / planning draft**.
Last updated: 2026-04-15.
Owner: (tbd)

## Why

Today, a user who writes

```ts
class Post extends Base {
  static {
    this.attribute("title", "string");
    this.hasMany("comments");
    this.belongsTo("author");
    this.scope("published", (rel) => rel.where({ published: true }));
  }
}
```

has to also write these `declare` lines to get any typing:

```ts
declare title: string;
declare comments: Comment[];
declare author: Author | null;
declare static published: () => Relation<Post>;
```

The `declare` catalog is documented in `CLAUDE.md` and the deviations
guide, and it works, but every attribute / association / scope / enum
method is typed twice: once in the runtime call, once in the manual
`declare`. Copying is error-prone (typos in names, wrong target class,
stale `declare` after a rename).

**Goal:** writing the runtime call alone should be enough for the type
system to see the member. Zero `declare` for the common case.

## What we already ruled out

Running through the TS extension surface:

| Approach                                        | Works at `tsc`? | Works in editor? | Blocker                                                                                                    |
| ----------------------------------------------- | --------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Mixin factory (`withAssociations(Base, {...})`) | Yes             | Yes              | Can't carry private statics; breaks `extends` chain                                                        |
| Stage-3 class decorator                         | Yes             | Yes              | Decorator return type doesn't propagate to instance lookups (verified in isolation)                        |
| `ts-patch` / compiler transformer               | Yes             | Yes              | Patches the `typescript` module on install; fragile across TS minor versions; hostile to library consumers |
| Language-service plugin alone                   | No              | Yes              | CLI `tsc`/CI doesn't load plugins                                                                          |
| Codegen alone (`.generated.d.ts`)               | Yes             | Yes              | Stale-file footgun in tight edit loop                                                                      |
| **Codegen + language-service plugin**           | **Yes**         | **Yes (live)**   | This proposal                                                                                              |

So the shortlist is (a) ship generated `.d.ts` files _or_ (b) combine
codegen with a tsserver plugin that keeps the editor in sync without
waiting for a regenerate step.

## Proposed design

### Two artifacts

1. **Codegen CLI** (`@blazetrails/codegen` or
   `scripts/model-typegen/`) — walks `packages/*/src/**/*.ts` via
   `ts.createProgram`, finds `class X extends Base { static { ... } }`
   bodies, and emits a co-located `.generated.d.ts` per source file
   using declaration merging:

   ```ts
   // post.generated.d.ts
   import type { CollectionProxy, Relation } from "@blazetrails/activerecord";
   import type { Author } from "./author.js";
   import type { Comment } from "./comment.js";
   declare module "./post.js" {
     interface Post {
       title: string;
       comments: Comment[];
       author: Author | null;
     }
     namespace Post {
       function published(): Relation<Post>;
     }
   }
   ```

   CI runs `pnpm typegen && git diff --exit-code` so drift fails the build.

2. **tsserver plugin** (`@blazetrails/tsserver-plugin`) — enabled via
   `tsconfig.json`'s `compilerOptions.plugins`. Same AST walker,
   same member synthesis, but runs inside the language service and
   patches the TypeScript checker's symbol table live. Users type
   `this.hasMany("comments")` and IntelliSense sees `post.comments`
   immediately without waiting for codegen or a recompile.

The plugin is a DX enhancement for the edit loop; correctness lives
with the codegen artifact and CI.

### Runtime call → declaration mapping

| Runtime call                                                    | Emitted declaration                                                                                        | Target inference                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `this.attribute(name, "string", opts?)`                         | `name: string`                                                                                             | literal `"string" \| "integer" \| ...` → `string \| number \| ...` |
| `this.attribute(name, "string", { default: ..., null: false })` | `name: string`                                                                                             | `null: false` drops nullability                                    |
| `this.hasMany(name, opts?)`                                     | `name: TargetClass[]`                                                                                      | classify(singularize(name)) or `opts.className`                    |
| `this.hasAndBelongsToMany(name)`                                | `name: TargetClass[]`                                                                                      | same                                                               |
| `this.belongsTo(name)`                                          | `name: TargetClass \| null`                                                                                | classify(name) or `opts.className`                                 |
| `this.hasOne(name)`                                             | `name: TargetClass \| null`                                                                                | same                                                               |
| `this.scope(name, fn)`                                          | `namespace X { function name(...args): Relation<X> }`                                                      | scope-fn param types (via checker inference)                       |
| `this.enum(attr, map, opts?)`                                   | per-value: `is<Value>(): boolean; <value>Bang(): this` + `namespace X { function <value>(): Relation<X> }` | `Base.enum` shape                                                  |
| `defineEnum(this, attr, map)`                                   | richer shape: + `<value>(): void`, `<value>Bang(): Promise<void>`, `not<Value>(): Relation<X>`             | per `src/enum.ts`                                                  |

### Attribute-type dictionary

A single source of truth for `"string" → string`, `"integer" → number`,
etc. lives alongside the runtime type registry
(`packages/activemodel/src/types/` or similar) so the codegen and the
runtime never disagree.

### Target-class resolution

1. If options include `className: "Foo"`, look up `Foo` in the
   program's symbol table.
2. Otherwise apply the same Rails inflection rules already in
   `@blazetrails/activesupport` (`camelize(singularize("posts"))`).
3. If resolution fails, emit a diagnostic (and a warning `.generated.d.ts`
   comment) so the user either adds the import or passes `className:`.

### Handling polymorphic / through / aliasAttribute

- `polymorphic: true` → emit `name: Base | null` (or a declared union
  if the consumer configures one via a follow-up `.annotatedName.ts`
  hint file).
- `through:` → walk both associations to pick up the final target
  type; fall back to the through-target's class type.
- `aliasAttribute(new, old)` → emit the alias with the same type as
  the original.

### Escape hatches

- **Opt out per class:** `/** @trails-typegen skip */` above the class
  declaration.
- **Manual override:** user-authored `.d.ts` alongside the source wins;
  codegen never overwrites hand-declared members.

## Packaging & rollout

### Phase 1 — codegen only

- New workspace package `scripts/model-typegen/` (or
  `packages/model-typegen/` if we want to ship it externally).
- New root script `pnpm typegen`.
- CI job: `pnpm typegen && git diff --exit-code`.
- Migrate in-repo models _incrementally_: flip one file at a time by
  deleting the hand-written `declare`s once the generated file covers
  them.

### Phase 2 — tsserver plugin

- New workspace package `packages/tsserver-plugin/`.
- Shares the AST-walker + declaration-synthesizer with the codegen
  package.
- Enable via `tsconfig.json`:
  ```json
  { "compilerOptions": { "plugins": [{ "name": "@blazetrails/tsserver-plugin" }] } }
  ```
- VS Code requires the user to select "Use Workspace Version" for TS
  (documented; doc PR follows).

### Phase 3 — docs + deprecation of manual declares

- Update CLAUDE.md, the declare catalog, website guides.
- Deprecate (not remove) the declare pattern; keep it as the escape
  hatch for edge cases the generator can't infer.
- DX tests: keep `declare-patterns.test-d.ts` to pin the manual path,
  add a parallel `generated-patterns.test-d.ts` that imports a fixture
  with only runtime calls and exercises the generated types.

## Risks

| Risk                                      | Mitigation                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Stale `.generated.d.ts` after an edit     | tsserver plugin synthesizes live; CI enforces regeneration                         |
| Codegen tool drifts from runtime behavior | Attribute-type dict is shared source; runtime tests + dx tests catch drift         |
| Bad target-class inference                | Fail loud (diagnostic + warning comment); user supplies `className:`               |
| Library consumers don't opt into plugin   | Codegen still works; plugin is pure DX improvement                                 |
| TS version lock-in                        | Plugin depends on tsserver internals; pin supported range + re-test per TS release |
| CI perf                                   | Run typegen as a separate job alongside typecheck; cache on source hashes          |

## Open questions for the maintainer

Before building, confirm:

1. **Ship the codegen tool as a public npm package**, or keep it in-repo
   under `scripts/`? Public is more work (version policy, changelog)
   but gives library consumers the same DX.
2. **Where do generated files live?** Options:
   - Co-located `post.generated.d.ts` next to `post.ts` (easy for TS
     to pick up via `include`; noisy in tree).
   - Single `.trails/generated.d.ts` (cleaner tree; needs a global
     `declare module` augmentation).
   - Under `dist/` (only works post-build, breaks live dev).
3. **Should the plugin also run the codegen to disk** on save, or stay
   in-memory only? In-memory is simpler but means git-ignored users
   and CI run diverge.
4. **Commit generated files or gitignore them?** Committed = easy diff
   review, noisy PRs. Ignored = every clone needs `pnpm typegen`.
5. **Convention override policy:** if a user manually writes `declare
foo: X` AND `this.attribute("foo", "string")`, who wins? Default
   proposal: user's manual declare wins; codegen skips. Worth flagging
   explicitly in the plan.
6. **Decorator metadata / reflection options** currently enabled on
   `packages/activerecord/tsconfig.json` — stay on, stay off, or flip
   per-package? Codegen doesn't need them, but the plugin path should
   verify compatibility.
7. **What's the supported editor matrix?** Just VS Code, or also
   Zed / WebStorm / nvim-lspconfig? tsserver plugins work anywhere
   that talks to tsserver, but we may want explicit test coverage.
8. **Rails `inverse_of` and circular references** — which side owns
   the typed accessor when both sides `hasMany`/`belongsTo` each
   other? Current `declare` pattern expects the user to handle it;
   auto-codegen has to resolve it deterministically (e.g., emit both
   with lazy `import type`).

Answer these and the plan locks down to a definite RFC.

## Non-goals

- Replacing the `declare` pattern entirely. It stays as the escape
  hatch for conditionals / unusual shapes the generator can't infer.
- Runtime changes. Codegen is purely type-level; runtime behavior is
  the source of truth.
- Auto-typing `where`/`order`/`pluck` column arguments. That's a
  separate design problem requiring removal of `Model`'s index
  signature, which is breaking.
