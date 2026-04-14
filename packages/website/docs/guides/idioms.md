---
title: Trails Idioms
description: Translation patterns from Rails to Trails — the naming, async, and options-object conventions every Trails guide uses.
---

# Trails Idioms

> **See also:** [Guides index](./index.md) · [Rails deviations](./activerecord-rails-deviations.md)

A Rails developer opening any Trails guide should recognize the shape
of the code immediately. This page is the translation reference. It
covers the conventions every guide follows so they don't have to
re-explain them per page.

If you're writing a guide, copy from here. If you're reading one, this
is the Rosetta stone.

## Method names are camelCase

Every Trails method is the camelCase form of its Rails counterpart.
No exceptions.

| Rails                  | Trails                |
| ---------------------- | --------------------- |
| `before_save`          | `beforeSave`          |
| `has_many`             | `hasMany`             |
| `primary_key`          | `primaryKey`          |
| `find_each`            | `findEach`            |
| `find_or_create_by`    | `findOrCreateBy`      |
| `previous_changes`     | `previousChanges`     |
| `establish_connection` | `establishConnection` |
| `default_scope`        | `defaultScope`        |

## `!` becomes `Bang`

Ruby uses `!` on a method name to mean "throw on failure instead of
returning false." `!` isn't a legal identifier character in JS, so
Trails uses a `Bang` suffix.

| Rails        | Trails          |
| ------------ | --------------- |
| `save!`      | `saveBang`      |
| `update!`    | `updateBang`    |
| `destroy!`   | `destroyBang`   |
| `create!`    | `createBang`    |
| `toggle!`    | `toggleBang`    |
| `increment!` | `incrementBang` |
| `decrement!` | `decrementBang` |
| `draft!`     | `draftBang`     |

Non-bang versions return `Promise<boolean>` and don't throw on
validation/constraint failure, matching Rails. Bang versions throw
and return `Promise<true>` / `Promise<this>`.

## `?` becomes `is`

Rails predicate methods end in `?`. JS drops that and uses an `is`
prefix.

| Rails         | Trails          |
| ------------- | --------------- |
| `valid?`      | `isValid()`     |
| `persisted?`  | `isPersisted()` |
| `new_record?` | `isNewRecord()` |
| `destroyed?`  | `isDestroyed()` |
| `changed?`    | `isChanged()`   |
| `published?`  | `isPublished()` |

## DB calls are always `await`ed

Every read, write, validation-with-I/O, and transaction in Trails
returns a `Promise`. There is no synchronous escape hatch.

```ts
import { type Base } from "@blazetrails/activerecord";

interface User extends Base {
  name: string;
}
declare const User: typeof Base;

const user = (await User.find(1)) as User;
user.name = "Dean";
await user.save();

for await (const _record of User.all().findEach()) {
  // ...
}
```

A common mistake: calling `.toArray()` or `.count()` on the same
relation twice issues two round-trips. Preload, or cache the result.

See [Rails deviations: async propagation](./index.md#async-propagation)
for the full list of methods this affects.

## Keyword args become one options object

Ruby keyword arguments become a single options object, always the
last argument.

```ts
import { type Base } from "@blazetrails/activerecord";

declare const Post: typeof Base;

// Rails:  Post.where(published: true, archived: false).order(:title)
// Trails:
Post.where({ published: true, archived: false }).order("title");

// Rails:  validates :title, presence: true, length: { minimum: 3 }
// Trails:
Post.validates("title", { presence: true, length: { minimum: 3 } });
```

## Symbols become strings

Ruby `:symbol` has no JS equivalent. All options and attribute names
use string literals.

```ts
import { type Base } from "@blazetrails/activerecord";

declare const Post: typeof Base;

// Rails:  enum status: [:draft, :published]
// Trails:
Post.enum("status", { draft: 0, published: 1 });

// Rails:  Post.where(status: :draft)
// Trails:
Post.where({ status: "draft" });
```

## Blocks become functions

Ruby blocks become (possibly-async) callback functions. See
[Block APIs → callback functions](./index.md#block-apis) for the
full signatures.

```ts
import { type Base } from "@blazetrails/activerecord";

declare const Post: typeof Base;

// Rails:
//   Post.transaction do
//     post.save!
//     comment.save!
//   end
//
// Trails:
import { transaction } from "@blazetrails/activerecord";

await transaction(Post, async (_tx) => {
  await post.saveBang();
  await comment.saveBang();
});
```

The body is an async function. The model class is the first argument
(module-level function, not a static method). See the
[ActiveRecord deviations guide](./activerecord-rails-deviations.md)
for why.

## Class bodies use `static {}`

Rails puts class-level configuration in the class body directly
(`validates :name, presence: true`). Trails puts the equivalent in a
static initializer block.

```ts
import { Model } from "@blazetrails/activemodel";

// Rails:
//   class Post < ActiveModel::Model
//     attribute :title, :string
//     validates :title, presence: true
//   end
//
// Trails:
class Post extends Model {
  static {
    Post.attribute("title", "string");
    Post.validates("title", { presence: true });
  }
}
```

The `static {}` block runs once when the class is first loaded, same
as Ruby's class body.

## Attributes are bracket-accessed internally, dot-accessed externally

Rails exposes attributes as methods: `post.title`. Trails exposes
them as properties: `post.title`. Same shape. The difference is
explicit access for typed code:

```ts
import { type Base } from "@blazetrails/activerecord";

declare const post: InstanceType<typeof Base>;

// Rails:                   Trails:
// post.title              post.title                // same
// post[:title]            post.readAttribute("title")
// post[:title] = "new"    post.writeAttribute("title", "new")
```

Use `readAttribute`/`writeAttribute` when you need runtime-typed
access (generic code operating over unknown columns).

## Ranges are plain objects

Ruby `Range` (`1..10`, `1...10`) has no JS equivalent. Use
`makeRange` from `@blazetrails/activesupport`.

```ts
import { type Base } from "@blazetrails/activerecord";
import { makeRange } from "@blazetrails/activesupport";

declare const Post: typeof Base;

// Rails:  Post.where(views: 100..1000)
// Trails:
Post.where({ views: makeRange(100, 1000) });

// Rails:  Post.where(views: 100...1000)   # exclusive end
// Trails:
Post.where({ views: makeRange(100, 1000, true) });
```

## Connection and transaction state is per-async-flow

Rails uses thread locals. Trails uses `AsyncLocalStorage`. Practical
effect: nested `await`s see the correct surrounding transaction and
connection without you threading anything through. If you spawn
unattached work (`setTimeout`, unawaited promises), you lose the
context the same way Rails loses thread locals when you spawn a new
thread.

See [Rails deviations: async-context state](./activerecord-rails-deviations.md)
for the underlying mechanism.

## Type imports for writing examples

Guides import real types from `@blazetrails/*`. In short illustrative
snippets, the shared globals (`user`, `post`, `User`, `Post`,
`AnyRecord`) are declared as `any` and don't need importing. For
full examples, always import from the package:

```ts
import { type Base } from "@blazetrails/activerecord";
import { Model } from "@blazetrails/activemodel";
import { transaction } from "@blazetrails/activerecord";
```

CI compiles every `ts` block in every guide against the real package
types. If you add a guide example, run `pnpm guides:typecheck`
locally before opening the PR. See
[scripts/guides-typecheck/README.md](https://github.com/blazetrailsdev/trails/blob/main/scripts/guides-typecheck/README.md)
for the check's contract and the `<!-- typecheck:skip -->` marker
for intentionally broken examples.
