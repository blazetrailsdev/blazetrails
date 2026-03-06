# rails-ts

A set of TypeScript packages that mirror the Rails API as closely as possible.
Someone reading the Rails API docs should be able to use these packages with
near-identical intent and naming.

## Project Structure

This is a TypeScript monorepo. Packages live under `packages/`:

- `packages/arel` — Query building and AST (Arel)
- `packages/activemodel` — Validations, callbacks, dirty tracking, serialization (ActiveModel)
- `packages/activerecord` — ORM layer tying Arel and ActiveModel together (ActiveRecord)

## Design Principles

- **Rails API fidelity**: Class names, method names, and call signatures should
  match Rails as closely as TypeScript allows. When the Rails docs say
  `User.where(name: "dean").order(:created_at)`, the TS equivalent should feel
  the same.
- **Idiomatic TypeScript**: Use TypeScript's type system to provide safety that
  Ruby can't. Generics, literal types, and discriminated unions are encouraged
  where they improve the developer experience without breaking Rails parity.
- **No magic strings where types work**: Prefer typed column references over
  raw strings when possible, but always support the string form for parity.
- **Incremental delivery**: The project is built in phases (see `docs/phases/`).
  Each phase should produce a usable, tested subset of functionality.

## Conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- Do NOT add "Co-Authored-By" lines to commit messages.
- Tests live next to source files as `*.test.ts`.
- Prefer small, focused modules over large files.

## Phase Tracking

Phases are documented in `docs/phases/`. Each phase file is numbered with sparse
IDs (100, 200, ...) to allow insertion of intermediate phases later.
