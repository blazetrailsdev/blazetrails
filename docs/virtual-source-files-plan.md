# Plan: Auto-Typed Models via Virtual Source Files

Status: **proposal / planning draft** (Rails-fidelity revision).
Last updated: 2026-04-15.

Related:

- Current manual pattern: [CLAUDE.md § "The `declare` pattern for typed runtime-attached members"](../CLAUDE.md).
- Canonical compiled reference for the manual pattern:
  [`packages/activerecord/dx-tests/declare-patterns.test-d.ts`](../packages/activerecord/dx-tests/declare-patterns.test-d.ts).

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
declare comments: AssociationProxy<Comment>;
declare author: Author | null;
declare static published: () => Relation<Post>;
```

Every attribute / association / scope / enum is typed twice — once in the
runtime call, once in the manual `declare`. Copying is error-prone (typos,
wrong target class, stale declares after a rename).

**Goal:** writing the runtime call alone is enough for the type system to
see the member. Zero `declare` for the common case.

## Rails fidelity is the bar

The plan now explicitly calls for runtime changes where the existing
runtime diverges from Rails. Backwards compatibility is **not** a
constraint — pre-1.0 trails has no external consumers depending on the
divergence, and getting the runtime right is what makes the virtualizer
output honest.

The single divergence this plan addresses head-on:

- **`blog.posts` returns `Base[]` today; Rails returns a `CollectionProxy`.**
  Rails (`activerecord/lib/active_record/associations/collection_association.rb#reader`):
  `@proxy ||= CollectionProxy.create(klass, self); @proxy.reset_scope`.
  CollectionProxy inherits from Relation and is awaitable / chainable.
  Trails' `AssociationProxy<T>` (already implemented as a JS Proxy in
  `packages/activerecord/src/associations/collection-proxy.ts`) is the
  exact analog — it just isn't wired into the reader. Phase R below
  swaps it in.

Other surfaces (`belongsTo` / `hasOne` returning the record or null,
`scope` returning a Relation, attribute getters returning the typed
value) already match Rails; no runtime change needed.

**Pragmatic divergences left in place (out of scope for this plan):**

- **Sync vs. lazy-load on `post.author`.** Rails' `post.author` triggers
  a lazy SQL query if the association isn't loaded. JS has no
  blocking-IO equivalent, so trails returns the currently-loaded value
  (or `null`). Users wanting to ensure load call
  `await post.loadAssociation("author")` (or use the explicit async
  helper). Documented as a permanent deviation in
  `docs/activerecord-rails-deviations.md`.
- **Enum predicate / bang naming.** Rails: `post.draft?` / `post.draft!`.
  TypeScript can't have `?` or `!` in identifiers, so trails uses
  `post.isDraft()` / `post.draftBang()`. Permanent deviation; same
  reason.

## Before / after

**Before (today):**

```ts
// post.ts
import { Base, Relation, AssociationProxy } from "@blazetrails/activerecord";
import { Author } from "./author.js";
import { Comment } from "./comment.js";

class Post extends Base {
  declare title: string;
  declare comments: AssociationProxy<Comment>;
  declare author: Author | null;
  declare static published: () => Relation<Post>;

  static {
    this.attribute("title", "string");
    this.hasMany("comments");
    this.belongsTo("author");
    this.scope("published", (rel) => rel.where({ published: true }));
  }
}
```

**After (post-rollout):**

```ts
// post.ts — the source the user writes and commits
import { Base } from "@blazetrails/activerecord";

class Post extends Base {
  static {
    this.attribute("title", "string");
    this.hasMany("comments");
    this.belongsTo("author");
    this.scope("published", (rel) => rel.where({ published: true }));
  }
}
```

No generated files on disk. No `.trails/` directory. No gitignore entry.
The editor and `trails-tsc` see an in-memory version of this file with
the matching `declare` members spliced in. Nothing else exists.

## Design

### Two entry points, one package, one transform

The virtualization logic — "given a source file, return a transformed
source with `declare` members injected inline" — is the entire product.
It ships as a single module inside `@blazetrails/activerecord` with two
shells around it:

1. **CLI shell: `@blazetrails/activerecord/tsc` (bin: `trails-tsc`)** —
   thin wrapper around `ts.createProgram` with a custom `ts.CompilerHost`
   whose `getSourceFile` and `readFile` apply the virtualization.
2. **Editor shell: `@blazetrails/activerecord/tsserver-plugin`** — a
   TypeScript language-service plugin. Intercepts
   `LanguageServiceHost.getScriptSnapshot` and returns the virtualized
   snapshot per file.

Both shells call the same `virtualize(source, fileName)` function. Same
AST walker, same declaration synthesizer, same type registry.

### The virtualize function

```ts
// packages/activerecord/src/type-virtualization/virtualize.ts
export interface VirtualizeResult {
  text: string;
  deltas: LineDelta[]; // injected-line offsets; consumed by diagnostic remapping
}
export function virtualize(originalText: string, fileName: string): VirtualizeResult;
```

Operation is purely syntactic; no `ts.Program` or `TypeChecker` is needed.

Steps:

1. Parse `originalText` with `ts.createSourceFile`.
2. Walk top-level class declarations whose `heritageClauses` contain an
   `extends` identifier in the configured allow-list (default `["Base"]`).
3. For each matched class, walk every `ClassStaticBlockDeclaration` and
   collect runtime calls.
4. Map each call to a `declare` member string via the runtime call →
   declaration table below.
5. Splice the rendered declares immediately after each affected class
   body's opening `{`, recording `LineDelta` entries so the wrapper /
   plugin can remap diagnostics back to user coordinates.

### Transitive extends

`class Admin extends User extends Base` is real:

- A **symbol-aware walker pass** (held by the CLI / plugin, not by
  `virtualize()` itself) holds a `ts.Program` / `TypeChecker`, resolves
  each class's extends chain to its root, and produces the allow-list
  passed to `virtualize()` per file.
- `virtualize()` stays pure and unit-testable.

### Runtime call → declaration mapping

| Runtime call                                                    | Injected declaration                                                                                                                                          | Target inference                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `this.attribute(name, "string", opts?)`                         | `declare name: string;`                                                                                                                                       | literal `"string" \| "integer" \| ...` → `string \| number \| ...`                                   |
| `this.attribute(name, "string", { default: ..., null: false })` | `declare name: string;`                                                                                                                                       | `null: false` drops nullability                                                                      |
| `this.hasMany(name, opts?)`                                     | `declare name: AssociationProxy<TargetClass>;`                                                                                                                | classify(singularize(name)) or `opts.className`                                                      |
| `this.hasAndBelongsToMany(name)`                                | `declare name: AssociationProxy<TargetClass>;`                                                                                                                | same                                                                                                 |
| `this.belongsTo(name)`                                          | `declare name: TargetClass \| null;`                                                                                                                          | classify(name) or `opts.className`                                                                   |
| `this.hasOne(name)`                                             | `declare name: TargetClass \| null;`                                                                                                                          | same                                                                                                 |
| `this.scope(name, fn)`                                          | `declare static name: (...args: ScopeArgs) => Relation<ThisClass>;` where `ScopeArgs` is `fn`'s parameter list with the leading `Relation<ThisClass>` dropped | extract the inline `fn` expression's parameters, drop the first (`rel`), preserve the rest literally |
| `this.enum(attr, map, opts?)`                                   | per-value: `declare is<Value>: () => boolean; declare <value>Bang: () => this; declare static <value>: () => Relation<ThisClass>;`                            | `Base.enum` shape; honors `prefix` / `suffix` options                                                |
| `defineEnum(Class, attr, map, opts?)`                           | richer shape: + `declare <value>: () => void; declare <value>Bang: () => Promise<void>; declare static not<Value>: () => Relation<ThisClass>;`                | per `src/enum.ts`; honors `prefix` / `suffix`                                                        |

`AssociationProxy<T>` is the existing chainable, awaitable Rails-style
collection surface. Once Phase R lands the runtime change, the type the
virtualizer emits and what `blog.posts` returns at runtime will agree.

### Target-class resolution

Inside the virtualizer, target-class names are **strings**, not types.
Rules:

1. If options include `className: "Foo"`, emit `Foo`.
2. Otherwise apply Rails inflection from `@blazetrails/activesupport`
   (`classify(singularize("posts"))` → `Post`).
3. If `Foo` isn't in scope in the user's file, TS raises
   `Cannot find name 'Foo'`. The fix is an import in the user's source —
   same as today. We do not auto-inject imports into the virtual file.

`className: "..."` mirrors Rails' `class_name:`.

### Handling polymorphic / through / aliasAttribute

- `polymorphic: true` → emit `name: Base | null`. Narrowing beyond
  `Base` is user-side (runtime branch on `<name>_type`).
- `through:` → walk both associations to pick up the final target type.
- `aliasAttribute(new, old)` → alias carries the resolved type of the
  original.

### Escape hatches

- **Opt out per class:** `/** @trails-typegen skip */` JSDoc above the
  class declaration — virtualizer skips that class entirely.
- **Manual override per member:** any hand-authored `declare <name>` the
  user writes _wins_ — the virtualizer detects existing members by name
  and skips injection for collisions. Useful for polymorphic narrowing
  and members the synthesizer can't infer.

### Rails fidelity (recap)

- **Same call surface.** `this.attribute(...)`, `this.hasMany(...)`, etc.
  read identically to Rails.
- **Same naming conventions.** singularize / camelize / `class_name:`
  come from `@blazetrails/activesupport`.
- **Same return shapes after Phase R.** `blog.posts` is the Rails-style
  CollectionProxy/AssociationProxy; `post.author` is the loaded record
  or null; `Post.published()` is a Relation.

### Shared internals

Both shells share one module tree, all inside
`packages/activerecord/src/type-virtualization/`:

1. **`virtualize.ts`** — pure text-transform.
2. **`walker.ts`** — finds matching classes and extracts runtime calls.
   Symbol-aware transitive-extends pass also lives here.
3. **`synthesize.ts`** — renders one declaration string per call.
4. **`type-registry.ts`** — Rails attribute type → TypeScript type.

### Testing strategy

- **`virtualize()` unit tests** — fixture pairs (input.ts +
  expected.ts). Snapshot drift catches regressions.
- **Type-level correctness** — `dx-tests/virtualized-patterns.test-d.ts`
  exercising the synthesized members under `trails-tsc`.
- **Language-service integration** — spawn `tsserver` with the plugin,
  open a fixture, send completion at `record.|`, assert synthesized
  members appear.
- **Parity** — same fixture, two runs (manual declares vs. virtualized).
  Diagnostic output must match.
- **Runtime parity (new)** — for the Phase R reader change, verify
  `for (const p of blog.posts)`, `blog.posts.length`, `blog.posts[0]`,
  `blog.posts.map(...)`, and `await blog.posts` all behave the same as
  the previous `Base[]` while also unlocking `blog.posts.where(...)`.

## Packaging & rollout

Status legend: ✅ merged, 🚧 in flight, 📋 planned.

### Phase 0 — decorator-flag cleanup ✅ (#528)

Removed `experimentalDecorators` / `emitDecoratorMetadata` from the
four tsconfigs that carried them.

### Phase 1a — virtualize() pure text transform 🚧 (#529)

Lands `packages/activerecord/src/type-virtualization/` (virtualize,
walker, synthesize, type-registry). 27 passing tests, 18 fixture pairs.

**Open until Phase R lands**: emits `Target[]` for hasMany / HABTM
today. After Phase R, a one-liner switch in `synthesize.ts` and the
matching fixtures will flip these to `AssociationProxy<Target>`. Phase
1a can land first under the current types and update post-R, or wait
for R — see the ordering note below.

### Phase R — Rails-fidelity runtime fix 📋 (new, top priority)

Make `blog.posts` (and every collection association reader) return the
existing `AssociationProxy<T>` instead of `Base[]`. This is the only
runtime change in the plan. It's a pre-1.0 breaking change — by design.

Two sub-PRs, each independently testable:

- **R.1 — make CollectionProxy a drop-in for arrays.** Add
  `Symbol.iterator`, `length`, numeric indexing (via the existing JS
  Proxy `get` trap on string-coerced numeric keys), and the array
  prototype methods consumers actually use (`map`, `filter`, `forEach`,
  `find`, `some`, `every`, `includes`, `slice`, `reduce`, `at`). Each
  delegates to the loaded `_target`. **Iteration semantics:** sync
  iteration / array-method calls operate on the already-loaded target
  — they do not trigger a fresh DB load (JS has no blocking IO). For a
  fresh load, `await blog.posts` first (the proxy's existing thenable
  unchanged). No reader change yet — just additive surface on
  CollectionProxy. All existing tests stay green.

- **R.2 — swap the reader.** Override `defineReaders` in
  `packages/activerecord/src/associations/builder/collection-association.ts`
  so the `<name>` getter returns `association(this, name)` (the
  AssociationProxy) instead of `this.association(name).reader`. Writers
  (`blog.posts = [...]`) stay routed through `defineWriters` as today —
  the array on the right is normalized into the proxy's `_target`.
  Concrete update list:
  - `packages/activerecord/src/associations/builder/collection-association.ts` (the reader override)
  - `packages/activerecord/dx-tests/declare-patterns.test-d.ts` (lines ~62, ~175 — the `declare comments: Comment[]` pattern + matching test name)
  - `packages/activerecord/dx-tests/associations.test-d.ts` (line ~101)
  - `packages/activerecord/src/associations.test.ts` audit for `.posts.length` / `.posts.map(...)` / `for (const ... of blog.posts)` patterns (~3 hits today; all stay green via R.1's array-likeness)
  - `CLAUDE.md` — the declare catalog snippet (`declare posts: Post[]` → `declare posts: AssociationProxy<Post>`); update the prose around "synchronous reader" too
  - `docs/activerecord-rails-deviations.md` — record that the collection reader is now Rails-faithful (negative deviation removed)
  - `AssociationProxy` is already exported from
    `@blazetrails/activerecord` (verified — see
    `packages/activerecord/src/index.ts`); no new export needed.

  Side benefit: `blog.posts.published()` and other named scopes start
  type-checking through the existing `AssociationProxy<T>` Proxy
  delegation, matching Rails' `blog.posts.published`.

**Phase R exit criteria:**

- `blog.posts` returns the AssociationProxy at runtime.
- All existing array-style consumers (`for ... of`, `.length`, `.map`,
  indexed access) still work via the additive surface from R.1.
- `blog.posts.where(...).order(...).limit(...)` works without the
  `association(blog, "posts")` helper.
- CLAUDE.md updated; declare catalog references the new shape.
- `pnpm api:compare` is unchanged or up (the swap removes a fidelity
  divergence from the runtime; tests stay where they were).

### Phase 1a-fixup — flip virtualizer to `AssociationProxy<T>` 📋

After R.2 lands: change `synthesize.ts` from
`declare ${name}: ${target}[];` to
`declare ${name}: AssociationProxy<${target}>;` for hasMany /
hasAndBelongsToMany. Update the matching fixtures
(`02-has-many/expected.ts`, `13-has-and-belongs-to-many/expected.ts`,
`08-combined/expected.ts`). One file in source, three files in
fixtures, no behavior change beyond the emitted declaration.

### Phase 1b — `trails-tsc` CLI shell 📋

- Land `packages/activerecord/src/tsc-wrapper/` shipping as
  `@blazetrails/activerecord/tsc` with `bin: trails-tsc`.
- Compose the syntactic walker with the symbol-aware transitive-extends
  pass.
- Add `dx-tests/virtualized-patterns.test-d.ts` run under `trails-tsc`.
- Two-package composite fixture to verify `trails-tsc --build` respects
  virtualization across project references and build-info caching.

**Phase 1b exit criteria:**

- `trails-tsc` is byte-compatible with `tsc` for non-Base files
  (identical diagnostics).
- At least 3 in-repo models migrated by deleting their declares; repo
  typechecks under `trails-tsc`.
- CI runs `pnpm trails-tsc --noEmit` as a second typecheck job
  alongside plain `tsc`.

### Phase 2 — tsserver plugin 📋

- Land `packages/activerecord/src/tsserver-plugin/` shipping as
  `@blazetrails/activerecord/tsserver-plugin`.
- Plugin intercepts `getScriptSnapshot` and reuses the Phase 1
  `virtualize()`.
- Repo's own `tsconfig.json` enables the plugin.

**Phase 2 exit criteria:**

- Plugin produces virtualized snapshots matching `trails-tsc`
  byte-for-byte.
- VS Code completions / quick-info / go-to-def work for synthesized
  members.
- Perf: plugin overhead <50 ms per file open on a repo with 500+
  models.
- Documented install for VS Code, Zed, WebStorm, nvim (tier-1: VS
  Code).

### Phase 3 — docs + consumer cutover 📋

- Update CLAUDE.md, the declare catalog, website guides to show the
  zero-declare form as the default.
- `declare-patterns.test-d.ts` becomes "manual escape hatches"; the
  virtualized-patterns suite becomes the default reference.
- Publish consumer docs: one plugin line in `tsconfig.json`, swap `tsc`
  → `trails-tsc` in their typecheck script.
- Audit third-party tools that invoke `tsc` (tsup, vite, esbuild,
  rollup, ts-node); document the drop-in path for each.

**Phase 3 exit criteria:**

- 100% of in-repo models use the virtualized path.
- Website "getting started" shows the zero-declare form.
- External consumers can follow the install doc top-to-bottom without
  reading this plan.

### Ordering

The dependency graph is shallow:

```
Phase 0 ✅
   │
   ├── Phase 1a 🚧 (current)
   │       │
   │       └── Phase 1a-fixup ── needs Phase R
   │
   ├── Phase R (R.1 → R.2)  ── pre-req for 1a-fixup, Phase 1b dx-tests, Phase 3
   │
   └── Phase 1b ── needs Phase 1a; benefits from R for honest dx-tests
            │
            └── Phase 2 ── needs Phase 1b's shell logic
                  │
                  └── Phase 3
```

Recommendation: **land Phase R now, in parallel with 1a's review.** R
is a contained runtime change and its merge unblocks the 1a-fixup
one-liner. Phase 1b should wait for R so its dx-tests can assert
against the post-R (Rails-faithful) shapes from day one.

## Key design decisions

- **Packaging:** tooling ships as subpath exports on
  `@blazetrails/activerecord` (`/tsc`, `/tsserver-plugin`). One
  install, no version skew. `typescript` is a peerDependency.
- **User declares win.** Hand-authored `declare <name>` is left alone.
- **Editor matrix:** VS Code tier-1 (explicit install steps,
  integration test). Zed / WebStorm / nvim should work via the
  standard tsserver plugin mechanism.
- **Both-sides association typing.** `Post.belongsTo("author")` and
  `Author.hasMany("posts")` each emit their own declares.
- **Library publishing.** `trails-tsc --declaration` bakes injected
  declares into emitted `.d.ts`, so downstream consumers using plain
  `tsc` get correct types.
- **Source-line fidelity.** `virtualize()` returns transformed text
  plus a line-delta table; wrapper / plugin remap diagnostic ranges
  back to user coordinates before surfacing.
- **Vitest integration.** `typecheck.checker` accepts any executable,
  so `checker: "trails-tsc"` drops in.

## Risks

| Risk                                                     | Mitigation                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase R breaks consumers of `blog.posts` as an array     | R.1 (additive array-likeness on CollectionProxy) lands first and stays green; R.2 only flips the reader once R.1 covers every consumer pattern in the in-repo test suite |
| Virtualizer drifts from runtime behavior                 | Type registry is shared with runtime attribute typing; parity test runs in CI                                                                                            |
| Bad target-class inference                               | Emitted `Foo` surfaces as a normal "cannot find name" error in the user's file; escape hatch is `className:`                                                             |
| Consumers run `tsc` directly (not `trails-tsc`)          | Fail loud: unvirtualized program prints "Property 'title' does not exist" exactly as today; docs call out                                                                |
| Bundlers / other tools invoke `tsc` under the hood       | Audit common bundlers (tsup, vite, esbuild — most use their own parser, not `tsc`); doc the few that matter                                                              |
| `tsc --build` / composite project references             | `trails-tsc` intended to support `--build`; verify build-info caching with a composite fixture in Phase 1b                                                               |
| tsserver plugin depends on TS language-service internals | Pin supported TS range; re-test per TS minor release; keep plugin logic to public `LanguageServiceHost` API                                                              |
| Library consumers debugging "what TS sees"               | Ship `trails-tsc --print-virtualized <file>` to dump the synthesized source for any model                                                                                |
| Source maps / go-to-definition off by N lines            | Virtualizer splices text at known offsets; remap ranges via the delta table returned from `virtualize()`                                                                 |
| Editor type mismatch during plugin boot                  | Plugin is purely additive — worst case during boot is the old "`unknown`" behavior, not a new wrong answer                                                               |

## Non-goals

- Replacing the `declare` pattern entirely. Stays as the escape hatch
  for shapes the virtualizer can't infer.
- Auto-typing `where` / `order` / `pluck` column arguments. Still
  blocked on `Model`'s `[key: string]: unknown` index signature.
- Full `tsc` feature parity on day one. `trails-tsc` targets the
  common typecheck flow (`--noEmit`, `--build`, `--watch`); exotic
  flags can be added as consumer bug reports arrive.
- Backwards compatibility with the current `Base[]` reader shape (see
  Phase R rationale).

## Follow-ups once this is in

- **Association-option typing** —
  `belongsTo("author", { scope: (rel) => ... })` can narrow `rel` to
  `Relation<Author>` because the virtualizer knows the target.
- **Attribute-keyed query args** — still blocked on removing
  `Model`'s `[key: string]: unknown` index signature.
- **Enum value-label union types** — `defineEnum(..., { draft: 0, published: 1 })`
  → union over the mapping keys.
- **External consumer adoption metrics** — once Phase 3 lands, track
  how many downstream projects run `trails-tsc` vs. plain `tsc`.
