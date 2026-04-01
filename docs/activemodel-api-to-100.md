# ActiveModel API Compare: Road to 100%

Current state: **63.1%** (221 / 350 methods). **100%** tests (963/963). Target: 100% API.

```bash
pnpm run api:compare -- --package activemodel
pnpm run api:compare -- --package activemodel --missing  # show missing methods per file
```

---

## Remaining (129 missing methods)

Run `pnpm run api:compare -- --package activemodel --missing` to see the
full per-file breakdown. The largest gaps are in types, validations, and
serialization.

---

## Milestones

| Target         | Status                           |
| -------------- | -------------------------------- |
| **75%** (~68)  | ✅                               |
| **85%** (~77)  | ✅                               |
| **94.5%** (86) | ✅ Current                       |
| **100%** (91)  | 5 remaining — likely a single PR |
