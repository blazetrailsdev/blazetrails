# ActiveRecord: Deviations from Rails

ActiveRecord is where JavaScript's async single-threaded model has the
biggest impact. Almost every DB-touching method in Rails is synchronous;
in Trails, almost every DB-touching method is async. This document
catalogs the differences so readers don't have to rediscover them one
test at a time.

Everything in the [ActiveModel deviations](./activemodel-rails-deviations.md)
doc applies here too (mixins, callbacks, attribute methods, etc.). This
doc focuses on what's new or amplified in ActiveRecord.

## 1. Async everywhere DB is touched

This is the single biggest deviation. Rails:

```ruby
user = User.find(1)        # sync
user.name = "Dean"
user.save                  # sync
posts = user.posts.to_a    # sync
```

Trails:

```ts
const user  = await User.find(1);
user.name   = "Dean";
await user.save();
const posts = await user.posts.toArray();
```

Every read and every write is a `Promise`. Concretely:

- **Finders**: `find`, `findBy`, `first`, `last`, `take`, `exists?`,
  `count`, `sum`, `minimum`, `maximum`, `pluck`, `ids`, `each`,
  `findEach`, `findInBatches`, `inBatches` — all async. See
  `packages/activerecord/src/relation/finder-methods.ts`.
- **Relation materialization**: `toArray()` replaces Rails' `to_a`/
  implicit `each`, and is async. Relations are lazy like in Rails, but
  you have to explicitly await the terminal operation.
- **Persistence**: `save`, `save!`, `create`, `update`, `update!`,
  `destroy`, `destroy!`, `toggle!`, `touch`, `updateColumn`,
  `updateColumns`, `increment!`, `decrement!` — all async. See
  `packages/activerecord/src/persistence.ts`.
- **Associations**: `user.posts`, `post.author` return relations/
  promises — accessing them is async because loading them is.
- **Schema / connection calls**: every adapter method (`executeQuery`,
  `selectAll`, `insert`, `executeMutation`, `beginTransaction`,
  `commit`, `rollback`) returns `Promise`.

There is no synchronous escape hatch. Browser and Node both expose DB
access through async drivers.

### Practical consequences

- `if (user.valid?)` in Rails becomes `if (record.isValid())` in
  Trails — still synchronous — **but** if any uniqueness validator
  fired, you must `await` its pending promise before trusting
  `record.errors`. `save()` does this for you; manual `isValid()`
  callers don't get it for free. See
  `packages/activerecord/src/validations/uniqueness.ts`.
- Sequencing matters. `user.posts.toArray()` and `user.posts.count()`
  are separate round-trips unless you preload. Accidentally awaiting
  the same relation twice issues two queries.
- Iteration is async: `for await (const record of Model.findEach())`
  rather than `Model.find_each do |record| ... end`.

## 2. Transactions: function, not block

Rails:

```ruby
User.transaction do
  user.save!
  post.save!
end
```

Trails:

```ts
await User.transaction(async (tx) => {
  await user.save();
  await post.save();
});
```

The shape is intentionally close: both pass a body that runs inside a
transaction and rolls back on any thrown error. The differences:

- The body is an **async function**, not a block.
- **Transaction state rides on `AsyncLocalStorage`**, not a thread
  local. Nested `await`s see the correct surrounding transaction
  because the async context propagates automatically. See
  `packages/activerecord/src/transactions.ts` and the async-context
  adapter in `@blazetrails/activesupport`.
- Options (`isolation`, `requiresNew`, `joinable`) are passed as a
  third argument rather than as keyword args.

## 3. Async-context state instead of thread locals

Rails uses `Thread.current` / `ActiveSupport::IsolatedExecutionState`
for per-request state: current transaction, query cache, connection
handler role, `Current` attributes. Node has no threads in the Rails
sense, so Trails uses `AsyncLocalStorage` (with a browser fallback)
wrapped by `@blazetrails/activesupport`'s `getAsyncContext()`.

Current uses:

- **Current transaction** — `packages/activerecord/src/transactions.ts`.
- **Query-prohibit scopes** — `connection-handling.ts` uses an
  `AsyncContext<boolean>` to track `whileDisconnecting` and friends.
- **Current attributes** — `current-attributes.ts` in ActiveSupport.

The behavior matches Rails for any code that stays in a single
async flow. If you spawn unattached work (`setTimeout`, `queueMicrotask`
without `await`), you lose the context the same way Rails loses thread
locals when you spawn a new thread.

## 4. Connection handling: no implicit global

Rails leans on `ActiveRecord::Base.connection` as a near-global. In
Trails, each `Base` subclass holds its own `_connectionHandler`, and
pools are acquired per query rather than checked out per thread.
`establishConnection` / `connectsTo` shape mirrors Rails; the
underlying pool model is different because there are no threads to
pool over. See `packages/activerecord/src/connection-handling.ts` and
`docs/activerecord-connections-and-pools.md` for the full story.

## 5. Relation `method_missing` → typed `Proxy`

Rails' `ActiveRecord::Relation` uses `method_missing` to forward
unknown calls to the model class (for named scopes and class-method
delegation). We do the same thing with a `Proxy` wrapper
(`wrapWithScopeProxy` in
`packages/activerecord/src/relation/delegation.ts`). Every relation
returned by `all()`, `where()`, `order()`, etc. is wrapped so that
`User.where({ active: true }).published()` resolves `published`
against the model's registered scopes.

This is one of very few places we reach for `Proxy`. We use it here
because the set of methods is genuinely dynamic (scopes are
user-defined) and TypeScript's structural typing lets consumers
declare the scope signatures on their Relation type.

## 6. Named scopes: stored, not metaprogrammed

`scope("published", (rel) => rel.where({ published: true }))` stores
the function in a `_scopes` Map on the class and defines a static
method that delegates through `all()`. The Relation proxy above picks
the scope up on relation instances. See
`packages/activerecord/src/scoping/named.ts`.

## 7. Enums: explicit `defineProperty`, async bang methods

Rails' `enum status: [:draft, :published]` generates `draft?`,
`published?`, `draft!`, `published!`, and scopes. Trails does the same
but:

- Generation happens in `defineEnum`
  (`packages/activerecord/src/enum.ts`) via `Object.defineProperty`,
  not `define_method`.
- The **bang methods are async** because persisting the change hits
  the DB:

  ```ts
  await post.draftBang();    // Rails: post.draft!
  ```

  `post.isDraft()` and `post.draft()` (setter without persist) stay
  synchronous.

## 8. Ranges: plain object

Ruby's `Range` (`1..10`, `1...10`, `Date.new(..)..Date.new(..)`) has
no JS equivalent, so ActiveSupport exposes a plain typed object
`{ begin, end, excludeEnd }` and helper functions. `where({ age:
makeRange(18, 65) })` lowers to the right SQL via Arel. Rails passes
real `Range` instances; we pass this struct.

See `packages/activesupport/src/range-ext.ts`.

## 9. Numeric types

JavaScript has only `number` and `bigint`. Rails distinguishes
`Integer`, `Float`, `BigDecimal`. Trails maps them as:

- `Integer` → `number` (or `bigint` where 64-bit IDs demand it).
- `Float`, `Decimal` → `number` (full `BigDecimal` arithmetic is not
  attempted — this is a known lossy area; specific columns that need
  exact decimal math will need a Decimal type later).
- `Date`, `DateTime`, `Time` → JS `Date`.

If this matters for your use case, treat the column as a string and
parse it yourself. We intentionally don't ship a half-implemented
`BigDecimal`.

## 10. Adapters (beyond the DB): `fs` and `crypto`

Rails uses `File`, `FileUtils`, `OpenSSL`, and `SecureRandom`
directly. That is fine on servers and impossible in browsers.
ActiveSupport ships two adapters consumed by ActiveRecord:

- **`fs-adapter.ts`** — `FsAdapter` interface with `readFileSync`,
  `writeFileSync`, `existsSync`, `mkdirSync`, etc. Auto-registers
  `node:fs` + `node:path` at runtime when available. A browser host
  registers an in-memory or OPFS-backed implementation.
- **`crypto-adapter.ts`** — `CryptoAdapter` with `randomBytes`,
  `randomUUID`, `createHash`, `createHmac`, `createCipheriv`,
  `pbkdf2Sync`, `timingSafeEqual`. Auto-registers a Node-crypto
  wrapper; browsers register a `window.crypto`-based adapter.

Callers always go through `getFs()` / `getCrypto()` rather than
importing `node:fs` / `node:crypto` directly. This is how signed IDs,
message verifiers, schema cache persistence, and migration file I/O
all keep working in the browser.

More adapters are likely coming (e.g., process/env, timers) as
browser surface area grows.

## 11. Callbacks: async all the way down

Already covered in the [ActiveModel doc](./activemodel-rails-deviations.md#callbacks-async-capable),
but worth emphasizing here: because ActiveRecord callbacks commonly
need to hit the DB (`beforeSave` cascading to related records, etc.),
they are almost always async. Always `await` them when composing
manually; `save()` / `destroy()` / etc. do it for you.

## 12. Naming / keyword args / symbols

- `Model.where(name: "dean", active: true)` →
  `Model.where({ name: "dean", active: true })`.
- `has_many :posts, dependent: :destroy` →
  `Model.hasMany("posts", { dependent: "destroy" })`. String literals
  replace symbols throughout the options surface.
- snake_case → camelCase everywhere.

These are systematic, not per-method.

## Summary

| Area | Rails | Trails |
| --- | --- | --- |
| Finders / reads | Sync | Async (`await` required) |
| Persistence | Sync | Async |
| Relation iteration | `to_a`, `each` (sync) | `toArray()`, `for await` |
| Transactions | `transaction do ... end` | `await transaction(async (tx) => { ... })` |
| Per-flow state | `Thread.current` | `AsyncLocalStorage` via `getAsyncContext()` |
| Connection pool | Thread-checkout model | Per-handler pools, per-query acquisition |
| Relation method dispatch | `method_missing` | `Proxy` wrapper (`wrapWithScopeProxy`) |
| Scopes | Generated via `define_singleton_method` | `_scopes` Map + delegation |
| Enum bang methods | Sync | Async (`draftBang()` hits DB) |
| Ranges | `Range` | Plain `{ begin, end, excludeEnd }` |
| Numerics | `Integer`/`Float`/`BigDecimal` | `number`/`bigint` only |
| File / crypto access | Direct stdlib | Pluggable adapters for browser support |
| Callbacks | Ruby blocks | Async functions |
| Uniqueness validation | Sync DB hit | Async, coordinated via `_asyncValidationPromises` |

If something in Rails surprises you with its absence here, the most
common cause is: "it was synchronous in Ruby and the JavaScript
equivalent is async, so the signature changed." The second most
common is: "Ruby had a language feature (symbol, block, Range,
`method_missing`) and TypeScript doesn't, so we expressed the same
idea differently."
