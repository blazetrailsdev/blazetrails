# ActiveModel: Deviations from Rails

ActiveModel sits between Arel (pure, synchronous) and ActiveRecord (async,
I/O-heavy). Most of its surface is synchronous in both Rails and Trails, but
it's also where the Ruby → TypeScript idiom gap shows up most in the shape
of the API: mixins, callbacks, dirty tracking, attribute method generation,
and serialization.

## Module mixins: `include`, `extend`, `Included`, `Extended`

Ruby modules (`include SomeConcern`, `extend OtherConcern`, with `included
do ... end` / `extended do ... end` hooks) are the most-used metaprogramming
feature in Rails. TypeScript has no equivalent, so ActiveSupport ships a set
of helpers that get as close as the language allows.

- **`include(Klass, mod)`** copies instance methods from `mod` onto
  `Klass.prototype`. Skips methods already on the prototype. If the module
  exports a function keyed by the `included` Symbol, it runs that hook with
  the class as its argument. See `packages/activesupport/src/include.ts`.
- **`extend(Klass, mod)`** is the class-method equivalent. Copies onto the
  class itself and runs the `extended` Symbol hook.
- **`Included<Mod>` / `Extended<Mod>`** are type helpers that translate a
  module's `this`-typed functions into the method signatures the class will
  have after mixing. They give consumers the typing they'd otherwise lose.

Differences vs Ruby:

- Hooks use `Symbol.for("@blazetrails/activesupport:included")` rather than
  a magic method name. The symbol-based hook is imported by name, which
  plays nicer with TypeScript tooling than stringly-typed method lookup.
- Mixing is explicit and happens once at class-declaration time, rather
  than at `include` time as Ruby does inside the class body. The net effect
  is the same.

For single methods rather than whole modules, the pattern is
`this`-typed functions assigned directly to a class. See `CLAUDE.md` for
the spelling; examples live in `attribute-methods.ts`, `validations.ts`,
`callbacks.ts`, and many more.

ActiveSupport also has `concern.ts`, a port of
`ActiveSupport::Concern` for cases where we really want the Rails shape
(class-level DSL blocks nested inside a module). It's less commonly needed
because `Included<>` usually does the job.

## Attribute methods: generated, not `method_missing`

Rails' `ActiveModel::AttributeMethods` registers method *patterns*
(`_changed?`, `_was`, `reset_`, etc.) and routes calls through
`method_missing`. We can't do that in TypeScript without blinding the type
checker, so Trails generates the methods at class-definition time and
tracks them in a `_generatedMethods` Set.

- `AttributeMethodPattern` (`packages/activemodel/src/attribute-methods.ts`)
  holds the same prefix/suffix/proxy-target concept as Rails.
- `match()` still exists for the cases where we need to split a method name
  back into its attribute.
- The `[key: string]: unknown` index signature on `Base` means plain
  attribute access (`user.name`) doesn't need a proxy — it's just a
  property. The price is that TypeScript can't type it without a per-model
  declaration; consumers usually declare their fields explicitly.

Net effect: no `method_missing`, no `Proxy`, no runtime lookup on every
access. Slightly less dynamic than Rails, significantly friendlier to the
type checker.

## Dirty tracking: encapsulated in `DirtyTracker`

Rails scatters `@changed_attributes`, `@previously_changed`, etc. across
instance variables. Trails puts them on a `DirtyTracker` instance held at
`record._dirtyTracker` (`packages/activemodel/src/dirty.ts`). Accessors
like `record.changed`, `record.changes`, `record.previousChanges`
delegate. The public API is the same; the internals are one indirection
away.

## Callbacks: async-capable

Rails callbacks are Ruby blocks. Our callback signatures accept either
sync or async functions:

```ts
type CallbackFn       = (this: any, ...args: any[]) => void | Promise<void>;
type AroundCallbackFn = (this: any, fn: () => Promise<void>) => Promise<void>;
```

(See `packages/activemodel/src/callbacks.ts`.)

Implications:

- `runCallbacks` awaits each callback. Calling it is itself async.
- `around` callbacks receive a `() => Promise<void>` to invoke the inner
  chain, not a block with `yield`.
- `before_save :do_thing` (a symbol naming a method) becomes either a
  reference to a method name string or a direct function — we accept both.

This is a required deviation: nearly every real callback in an
ActiveRecord app needs to hit I/O, so callbacks had to be async-aware
from the start.

## Validations: sync signature, async reality

`validates` / `validate` look the same:

```ts
class Post extends Model {
  static {
    Post.validates("title", { presence: true, length: { minimum: 3 } });
  }
}
```

The deviation surfaces when a validator needs I/O. `uniqueness` is the
canonical case (it has to hit the DB), and it lives in ActiveRecord, not
ActiveModel, but ActiveModel is where the machinery that supports it
lives. `isValid()` stays synchronous for back-compat with Rails'
signature, and async validators push their `Promise`s onto
`record._asyncValidationPromises` for the caller to await. `save()`
awaits these automatically; bare `isValid()` callers have to do it
themselves.

See `packages/activerecord/src/validations/uniqueness.ts` for the
pattern; ActiveModel contributes the validator registration and error
accumulation.

## `withOptions`: one of the few Proxies

ActiveModel uses `Proxy` exactly once, in `Model.withOptions(defaults,
fn)`. Inside `fn`, calls to `validates` are rewritten to merge in the
defaults. This is pure sugar — a one-proxy convenience for a Rails-style
DSL block. See `packages/activemodel/src/model.ts`. Everything else in
ActiveModel is proxy-free.

## Serialization

`serializableHash()` produces the same shape as Rails'
`serializable_hash`. The one deviation: it understands attribute stores
with lazy `fetchValue()`, not just plain `Map`/object. Rails always
materializes attributes eagerly; we don't, because TypeScript makes lazy
stores easy and some of our adapters want them.

See `packages/activemodel/src/serialization.ts`.

## Small, systematic differences

- **Symbols → strings.** `validates :name, presence: true` becomes
  `validates("name", { presence: true })`. Ruby symbol literals have no
  JS equivalent.
- **Keyword args → options object.** Same story: `validates("name", {
  length: { minimum: 3, maximum: 20 } })`.
- **snake_case → camelCase.** `record.previous_changes` →
  `record.previousChanges`.
- **`try :foo` → `?.`** TypeScript's optional chaining replaces Ruby's
  safe-navigation helpers.
- **Range** — Ruby's `Range` becomes a plain `{ begin, end, excludeEnd }`
  object from `@blazetrails/activesupport`. Relevant to validators like
  `numericality: { within: makeRange(0, 100) }`.

## Summary

| Area | Rails | Trails |
| --- | --- | --- |
| Module inclusion | `include Mod`, `included do ... end` | `include(Klass, mod)` + `included` symbol hook; `Included<Mod>` for typing |
| Module extension | `extend Mod`, `extended do ... end` | `extend(Klass, mod)` + `extended` symbol hook; `Extended<Mod>` for typing |
| Attribute methods | `method_missing` + `define_method` | Generated methods in `_generatedMethods`; index signature for reads |
| Dirty tracking | Scattered ivars | `DirtyTracker` instance at `_dirtyTracker` |
| Callbacks | Blocks (`before_save do ... end`) | Async-capable functions; `runCallbacks` is async |
| Validations | Synchronous | Sync signature; async validators collected on `_asyncValidationPromises` |
| DSL sugar | Block receivers | One `Proxy` in `Model.withOptions` |
| Serialization | Eager map over ivars | Same API, supports lazy attribute stores |
| Symbols / kwargs / naming | `:symbol`, kwargs, snake_case | strings, options objects, camelCase |

The rule of thumb: if a thing is synchronous and pure, ActiveModel looks
essentially like Rails. The deviations cluster wherever Ruby used a
language feature (blocks, symbols, `method_missing`) that TypeScript
doesn't have, or where the downstream consumer (ActiveRecord) needs
async support.
