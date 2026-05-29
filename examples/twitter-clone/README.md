# Twitter clone — Express + ActiveRecord

A minimal Twitter/X clone showing how to use
[`@blazetrails/activerecord`](../../packages/activerecord) — the TypeScript
port of Rails' ActiveRecord — inside an [Express](https://expressjs.com/) app.

It exercises the parts of ActiveRecord you reach for first:

- **Connections & schema** — `Base.establishConnection` + `Schema.define`
  with the same `create_table` DSL Rails migrations use (`db.ts`).
- **Models** — `class X extends Base` with `this.attribute`, `belongsTo`,
  `hasMany`, `hasMany … through:` (self-referential follows!), scopes, and
  validations (`src/models/`).
- **Querying** — `findByBang`, `where`, `order`, `includes` (eager loading),
  `limit`, scopes, association proxies (`user.tweets.createBang(...)`), and
  `count`.
- **Error mapping** — `RecordNotFound` → 404, `RecordInvalid` → 422 (`app.ts`).

## Run it

From the repo root the packages must be built once (the example imports the
compiled `dist/`):

```sh
pnpm --filter @blazetrails/activerecord... build
```

Then, from this directory:

```sh
pnpm install          # if you haven't already at the workspace root
pnpm dump-schema      # (re)generate db/schema-columns.json from the schema
pnpm typecheck        # schema-driven type-check via trails-tsc (see below)
pnpm smoke            # runs the whole flow against in-memory SQLite, no HTTP
pnpm start            # boots the HTTP server on :3000 (in-memory SQLite)
```

To persist data across restarts (and seed it):

```sh
DATABASE_URL=sqlite3:twitter.db pnpm seed
DATABASE_URL=sqlite3:twitter.db pnpm start
```

`DATABASE_URL` also accepts `postgres://…` / `mysql://…` — the model code is
adapter-agnostic, exactly like Rails.

## API

| Method & path                        | Description                                      |
| ------------------------------------ | ------------------------------------------------ |
| `POST /users`                        | Create a user (`handle`, `display_name`, `bio?`) |
| `GET  /users/:handle`                | Profile + follower/following counts              |
| `POST /users/:handle/tweets`         | Post a tweet (`body`)                            |
| `GET  /users/:handle/tweets`         | A user's tweets, newest first                    |
| `GET  /users/:handle/timeline`       | Tweets from everyone they follow                 |
| `POST /users/:handle/follow/:target` | Follow another user                              |
| `POST /tweets/:id/like`              | Like a tweet (`handle` in body)                  |

### Example session

```sh
curl -X POST localhost:3000/users -H 'content-type: application/json' \
  -d '{"handle":"alice","display_name":"Alice"}'
curl -X POST localhost:3000/users -H 'content-type: application/json' \
  -d '{"handle":"bob","display_name":"Bob"}'
curl -X POST localhost:3000/users/bob/tweets -H 'content-type: application/json' \
  -d '{"body":"hello from bob"}'
curl -X POST localhost:3000/users/alice/follow/bob
curl localhost:3000/users/alice/timeline
# [{"id":1,"body":"hello from bob","author":"bob","created_at":"..."}]
```

## Zero-declare, schema-driven models via `trails-tsc`

The models in `src/models/` are pure Rails-style static blocks — **no
`declare` fields, no `this.attribute(...)` calls, no `import type { Tweet }`
lines.** Just associations, scopes, and validations:

```ts
export class User extends Base {
  static {
    this.hasMany("tweets", { dependent: "destroy" });
    this.hasMany("following", { through: "activeFollows", source: "followee", className: "User" });
    this.validates("handle", { presence: true });
    this.validatesUniqueness("handle");
    registerModel(this);
  }
}
```

Where do the attributes (`user.handle`, `tweet.body`, `created_at`, …) come
from? The **schema** — exactly like Rails, which reads them from the DB at
boot:

- **Types:** [`trails-tsc`](../../README.md#zero-declare-models--trails-tsc),
  a drop-in `tsc` replacement, reads `db/schema-columns.json` (the
  `--schema` flag in the `typecheck` script) and injects a `declare` member
  per column, plus association proxies (`user.tweets`), scope readers
  (`Tweet.recent()`), and target imports. Regenerate the JSON with
  `pnpm dump-schema` after any schema change. In a real app you'd instead run
  `trails-schema-dump --out db/schema-columns.json` against your live DB.
- **Runtime:** `db.ts` calls `Model.loadSchema()` for each model after
  migrating, reflecting the columns off the live database into the model.
  (Rails does this lazily on first use; we warm it eagerly so the first
  request is ready.)

Plain `tsc` **cannot** type these files — every attribute, association, and
scope comes back as `unknown`. That's the whole point: try
`pnpm exec tsc --noEmit` and watch it fail, then `pnpm typecheck` and watch
`trails-tsc` pass. The runtime (`tsx`) is unaffected either way.

> The activerecord package's `dx-tests/declare-patterns.test-d.ts` documents
> the manual `declare` + `this.attribute` escape hatch, for when you'd rather
> run with a stock `tsc` toolchain instead of `trails-tsc`.
