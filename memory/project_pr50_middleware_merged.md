---
name: PR 50 middleware cluster merged
description: All 4 AR middleware files (database-selector, resolver, session, shard-selector) landed in PR #1273
type: project
---

PR #1273 merged; all 4 middleware files at 100%:

- middleware/database-selector.ts (6/6)
- middleware/database-selector/resolver.ts (15/15)
- middleware/database-selector/resolver/session.ts (8/8)
- middleware/shard-selector.ts (6/6)

**Why:** Part of the AR 100% plan (PR 50 + 50b combined into one PR).

**Key design decisions:**

- `app` receives `(request)` not a Rack env hash — no Rack in TS
- `Temporal.Instant` throughout (no `new Date()`)
- `Number.isFinite` guard in session; epoch-0 fallback → routes to replica
- `ArgumentError` for non-convertible symbols in ShardSelector
- `this.instrumenter.instrumentAsync` in resolver private methods (not Notifications directly)

**How to apply:** Next middleware-adjacent work should follow the same MiddlewareRequest interface pattern.
