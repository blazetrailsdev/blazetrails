# rails-ts

TypeScript packages that mirror the Ruby on Rails API.

The ultimate goal of this project is to be **100% API compatible with all of Rails**, matching the behavior **test for test**.

If you can read the [Rails API docs](https://api.rubyonrails.org/), you already
know how to use this. Class names, method signatures, and behavior are designed
to match Rails as closely as TypeScript allows — while adding the type safety
that Ruby can't.

## Packages

| Package | Rails Equivalent | Description |
|---------|-----------------|-------------|
| `@rails-ts/arel` | [Arel](https://api.rubyonrails.org/classes/Arel.html) | SQL AST builder and query generation |
| `@rails-ts/activemodel` | [ActiveModel](https://api.rubyonrails.org/classes/ActiveModel.html) | Attributes, validations, callbacks, serialization |
| `@rails-ts/activerecord` | [ActiveRecord](https://api.rubyonrails.org/classes/ActiveRecord.html) | ORM tying Arel and ActiveModel together |

## Quick Example

The goal is for Rails patterns to translate directly:

```ruby
# Ruby / Rails
users = Arel::Table.new(:users)
query = users.project(users[:name])
              .where(users[:age].gt(21))
              .order(users[:name].asc)
query.to_sql
# => SELECT "users"."name" FROM "users" WHERE "users"."age" > 21 ORDER BY "users"."name" ASC
```

```typescript
// TypeScript / rails-ts
const users = new Arel.Table("users");
const query = users.project(users.get("name"))
                   .where(users.get("age").gt(21))
                   .order(users.get("name").asc());
query.toSql();
// => SELECT "users"."name" FROM "users" WHERE "users"."age" > 21 ORDER BY "users"."name" ASC
```

## Design Principles

- **Rails API fidelity** — Names and call signatures match Rails. When the Rails
  docs show `User.where(name: "dean").order(:created_at)`, the TypeScript
  equivalent should feel the same.
- **Idiomatic TypeScript** — Generics, literal types, and discriminated unions
  are used where they improve the developer experience without breaking Rails
  parity.
- **Type-safe, string-friendly** — Typed column references are preferred, but
  the string form is always supported for parity with Rails.
- **Incremental** — Built to match the behaviors validated by the Rails test suite.

## Ruby to TypeScript Conventions

To maintain Rails parity while staying idiomatic to TypeScript, we follow a few standard transformations:

### Method Names
| Ruby / Rails | TypeScript / `rails-ts` | Example |
|--------------|-------------------------|---------|
| `valid?` | `isValid()` | Predicates (`?`) become `is*` prefix. |
| `save!` | `saveBang()` | Bang methods (`!`) become `*Bang` suffix. |
| `initialize` | `constructor` | Standard TypeScript class constructors. |
| `table[:id]` | `table.get("id")` | The `[]` operator is mapped to `get()`. |
| `model[:id]` | `model.readAttribute("id")` | Explicit attribute reading. |
| `model[:id] = 1` | `model.writeAttribute("id", 1)` | Explicit attribute writing. |

### Property Access
While Rails dynamically generates getters and setters for all database columns, TypeScript requires these to be known at compile-time. You can use `readAttribute` and `writeAttribute` for any field, or use `aliasAttribute` to create typed properties:

```typescript
class User extends Model {
  static {
    this.attribute("name", "string");
    this.aliasAttribute("name", "name"); // Creates u.name getter/setter
  }
}
```

## Project Status

This project is actively developed. We measure progress by comparing our API surface and test suite against the original Ruby on Rails source code.

### API Coverage (Methods)
| Package | Progress | Matched / Total |
|---------|----------|-----------------|
| `arel` | 100% | 152 / 152 |
| `activemodel` | 100% | 54 / 54 |
| `activerecord` | 99.6% | 224 / 225 |
| **Total** | **99.8%** | **430 / 431** |

### Test Parity (Behavior)
| Package | Progress | Matched / Total |
|---------|----------|-----------------|
| `arel` | 100% | 592 / 592 |
| `activemodel` | 98.3% | 758 / 771 |
| `activerecord` | 13.7% | 742 / 5428 |
| **Total** | **30.8%** | **2092 / 6791** |

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build all packages
npm run build
```

## Project Structure

```
packages/
  arel/           — SQL AST and query building
  activemodel/    — Validations, callbacks, dirty tracking, serialization
  activerecord/   — ORM layer (persistence, querying, associations)
```

## License

MIT
