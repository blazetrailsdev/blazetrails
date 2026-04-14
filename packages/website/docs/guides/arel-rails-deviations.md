# Arel: Deviations from Rails

Arel is the least-deviating package in Trails. It is a pure SQL AST builder
with no I/O, so JavaScript's async/single-threaded model has almost no impact.
The deviations here are mostly about Ruby idioms that don't translate
(symbols, `method_missing`, keyword args) and TypeScript features we use to
add safety Rails can't.

If you know Rails Arel, you already know Trails Arel. The shapes are
intentionally identical: `Table`, `SelectManager`, `Nodes`, `Attribute`,
visitors, and so on.

## Naming and arguments

- **snake_case → camelCase.** Every method is renamed (`project` stays
  `project`, `take` stays `take`, but `order_by` → `orderBy`, `from_clause`
  → `fromClause`, etc.). This is systematic across the whole codebase and
  not called out individually elsewhere.
- **Keyword args → options objects.** Ruby's `Arel::Table.new(:users, as: "u")`
  becomes `new Table("users", { as: "u" })`. No `**opts` splatting.
- **Symbols → strings.** Ruby passes `:users` to `Arel::Table.new`; we pass
  `"users"`. JavaScript has a `Symbol` primitive but no `:foo` literal, and
  symbols-as-identifiers is not idiomatic TS.

## Symbol branding instead of class checks

Rails Arel relies on Ruby's class system (`is_a?`) and duck typing
(`respond_to?`) to identify node kinds. We can't rely on `instanceof` across
module boundaries (multiple copies of a class can coexist across bundles), so
core node types are branded with `Symbol.for(...)` and detected by symbol
presence.

- See `packages/arel/src/nodes/binary.ts` for the `ATTRIBUTE_BRAND`
  pattern. `isAttribute(node)` checks the branded symbol rather than
  `instanceof Attribute`.

This is a pure-TS concern; Rails never needs it.

## No `method_missing`, no Proxy

Rails Arel uses `method_missing` in a few places (notably for attribute
access on `Arel::Table`: `users[:id]`). We don't use `Proxy` anywhere in
Arel. `Table#[]` is a real method that takes a string and returns an
`Attribute`. The call site is:

```ts
// Rails:  users[:id]
// Trails: users.get("id")   // or: users.attribute("id")
```

We considered a `Proxy`-backed `Table` that would make `users.id` work, but
chose the explicit accessor because the Proxy would defeat TypeScript's
property checking on the surrounding class. Typing wins over syntax.

## Generic typing of nodes

TypeScript lets us parameterize nodes where Rails just stores `Object`. A
`SelectManager<T>` knows the row shape it eventually produces, `Attribute<T>`
carries its column type, and visitor return types are inferred. This is
purely additive — Rails behavior is unchanged — and is the main reason
writing queries in Trails feels safer than in Rails.

## Sync vs async

Arel is 100% synchronous in both Rails and Trails. Nothing in `packages/arel`
returns a `Promise`. I/O happens in ActiveRecord's adapters, not here.

## What is *not* different

- AST node shape and naming (`Nodes::SelectStatement` → `SelectStatement`,
  same fields).
- Visitor pattern (`ToSql`, per-dialect subclasses).
- `Table`, `SelectManager`, `InsertManager`, `UpdateManager`,
  `DeleteManager` all have the same roles.
- Predicate factories on `Attribute` (`eq`, `notEq`, `in`, `matches`, etc.)
  mirror Rails method for method.

## Summary

| Area | Rails | Trails |
| --- | --- | --- |
| Method names | snake_case | camelCase |
| Arguments | Ruby keyword args / symbols | Option objects / strings |
| Node identity | `is_a?` / `respond_to?` | `Symbol.for` brands |
| Dynamic attr access | `method_missing` on `Table` | Explicit `table.get("id")` |
| Async | N/A (sync) | Same — still sync |
| Typing | Dynamic | Generic `SelectManager<T>`, `Attribute<T>` |
