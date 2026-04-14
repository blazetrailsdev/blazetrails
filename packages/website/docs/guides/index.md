---
title: Guides
description: Conceptual guides for Trails — how the TypeScript port relates to Rails, where it deviates, and why.
---

# Guides

Conceptual guides for Trails. The API reference tells you _what_ exists;
these guides tell you _why_ it looks the way it does.

## Rails deviations

Trails mirrors the Rails API as closely as TypeScript allows, but some
things can't (or shouldn't) cross the language gap unchanged. JavaScript
is async and single-threaded. Ruby modules have no direct equivalent.
Ruby symbols, keyword args, and blocks don't exist in TS. We also want
to run in the browser, which Rails does not. These guides document those
divergences per package so you don't have to rediscover them one test at
a time.

- [**Arel**](./arel-rails-deviations.md) — the least-deviating package.
  SQL AST building is purely synchronous; deviations are limited to
  naming, symbol branding, and added TypeScript generics.
- [**ActiveModel**](./activemodel-rails-deviations.md) — mixin helpers
  (`include`/`extend` with `Included`/`Extended` type helpers), generated
  attribute methods instead of `method_missing`, async-capable callbacks,
  encapsulated dirty tracking.
- [**ActiveRecord**](./activerecord-rails-deviations.md) — the biggest
  diff. Async propagation through finders, persistence, transactions,
  and enums; `AsyncLocalStorage` instead of thread locals; `Proxy`-based
  scope dispatch; pluggable `fs` and `crypto` adapters for browser
  support.

## Common themes

Three themes cut across all three packages; each guide points back to
the same root causes:

**Async propagation.** Every I/O call in Rails (DB, file system, crypto,
HTTP) is synchronous. Every equivalent in JavaScript is async. That one
fact propagates into finders, persistence, validations, callbacks,
transactions, and even enum bang methods.

**Module mixins.** Rails relies heavily on `include`/`extend` with
`included`/`extended` hooks. TypeScript has no equivalent, so
`@blazetrails/activesupport` ships `include(Klass, mod)`,
`extend(Klass, mod)`, and the `Included<Mod>` / `Extended<Mod>` type
helpers. Plus the `this`-typed function pattern (see `CLAUDE.md`) for
single-method mixing.

**Browser support via adapters.** Rails reaches for `File`, `OpenSSL`,
`SecureRandom` directly. Trails routes those through
`@blazetrails/activesupport`'s `FsAdapter` and `CryptoAdapter`, which
auto-register Node implementations and let browsers register their own.
More adapters will follow.

## Where to go next

- [**API reference**](/api/@blazetrails/arel/README) — generated from the
  source, one page per module per package.
- [**GitHub**](https://github.com/blazetrailsdev/trails) — source, issues,
  contribution notes.
