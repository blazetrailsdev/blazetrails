# ActiveRecord: Really Async (Thenable Relations)

## Problem

Evaluating a relation requires an explicit `.toArray()` call:

```ts
const users = await User.where({ active: true }).toArray();
```

This feels unnatural in async TypeScript. By making relations **thenable** —
implementing the `PromiseLike` protocol — they can be directly awaited:

```ts
const users = await User.where({ active: true });
```

## How Thenables Work

A **thenable** is any object with a `.then()` method matching the
`PromiseLike<T>` interface. When you `await` a value, the JS engine checks
if it has a `.then()` — if so, it calls it. This is a spec-level protocol
([ECMA-262 §27.2.4.7](https://tc39.es/ecma262/#sec-promise.resolve)).

Key constraint: `.then()` must **not** execute eagerly on construction. It
only triggers evaluation when called — which is exactly what `await` does.

## Design: `applyThenable` Mixin

A standalone mixin function in `packages/activerecord/src/relation/thenable.ts`.
It patches `.then()`, `.catch()`, and `.finally()` onto any prototype,
delegating to the specified evaluation method (default: `toArray`).

Uses `Object.defineProperty` with `enumerable: false` to keep protocol
methods out of `Object.keys()` and `for...in` loops.

## The `stripThenable` Escape Hatch

Async generators `yield` and `Promise.resolve()` both unwrap thenables.
This causes problems when a method intentionally returns a relation
instance (e.g., `load()`, `reload()`, `presence()`, `inBatches()`).

`stripThenable(obj)` shadows `.then` with `undefined` on a specific instance,
preventing unwrapping while preserving all other methods. Used in:

- `Relation.load()` / `Relation.reload()` — return `this` without unwrapping
- `Relation.presence()` — return `this` without unwrapping
- `Relation.inBatches()` — yield batch relations without unwrapping
- `CollectionProxy.reload()` — return `this` without unwrapping

## Classes Applied To

| Class                | Resolves to | Evaluation method |
| -------------------- | ----------- | ----------------- |
| `Relation<T>`        | `T[]`       | `toArray()`       |
| `CollectionProxy`    | `Base[]`    | `toArray()`       |
| `BatchEnumerator<T>` | `T[]`       | `toArray()`       |

## Key Behaviors

- `await User.where({ active: true })` → `User[]`
- `await User.where({ active: true }).order("name").limit(5)` → `User[]`
- `await Promise.all([query1, query2])` → `[User[], Post[]]`
- `relation instanceof Promise` → `false` (thenable, not a Promise)
- `.toArray()` still works — the thenable is additive
- No eager evaluation on construction
