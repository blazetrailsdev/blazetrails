---
name: PR #1334 Story A pg OID fallback + binary quoting merged
description: Story A merged — OID batch load in columns(), binary Uint8Array via Arel visitor quote(); 3 follow-up gaps documented
type: project
---

PR #1334 merged. bytea "write and read" + "write binary" un-skipped.

**What landed:**

- `columns()` batch-loads missing OIDs via `loadAdditionalTypes` (mirrors Rails `load_additional_types`); unknown OIDs register `ValueType` fallback to prevent repeated pg_type queries
- Arel visitor `quote()` delegates `Uint8Array` to `this.quoter.quote()` → adapter `quotedBinary()`
- `_performInsert`/`_performUpdate` compile via `adapter.arelVisitor.compile(ast)` so adapter quoter is used (not `defaultQuoter`)
- `DatabaseAdapter#quotedBinary()` added to interface; MySQL `quotedBinary` handles `Uint8Array` zero-copy
- PG and MySQL `quote()` route `Uint8Array` to `quotedBinary()`

**Follow-ups documented in PR body:**

1. `ArrayBuffer`/`ArrayBufferView` gap: Arel visitor and PG `quote()` only route `Uint8Array`; bare `ArrayBuffer` or other views still hit `String(value)`. Fix: detect `ArrayBuffer.isView(value)` and normalise to `Uint8Array`.
2. MySQL `quotedBinary` runtime type checks: currently uses type assertion; should throw `TypeError` with helpful message for unsupported shapes (like PG/SQLite do).
3. to-sql.test.ts comment: says `String(Uint8Array)` causes UTF-8 replacement-char corruption — actually produces comma-joined decimal list. Rephrase to "wrong SQL literal".

**Why:** `HashLookupTypeMap` registers by SQL name not OID; `im.toSql()` used `defaultQuoter` (no adapter wired).
**How to apply:** Follow-up PR for ArrayBuffer gap; rest are low-priority cleanup.
