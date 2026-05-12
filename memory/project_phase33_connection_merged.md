---
name: Phase 3.3 connection.test.ts merged
description: PR #1326 merged; 14 remaining BLOCKEDs with precise scopes documented; follow-up cluster identified
type: project
---

PR #1326 merged. abstract-mysql-adapter/connection.test.ts: 23 BLOCKED → 14 BLOCKED (9 un-skipped + 3 new tests + 1 spurious removed).

**Why:** Leaf-first test coverage drive for the adapter-mysql (145) bucket.

**How to apply:** Next phase 3 PR for this file should target the session-variable wiring cluster (6 tests) or the reconnect cluster (3 tests) as the highest-yield group.

## 14 remaining BLOCKEDs by cluster

**Reconnect cluster (3 tests) — mysql2-adapter.ts**

- "no automatic reconnection after timeout" — `active` checks `_driverPool != null`, not socket ping
- "successful reconnection after timeout with manual reconnect" — `reconnectBang()` not implemented (no stored config)
- "successful reconnection after timeout with verify" — same gap as reconnectBang
- Fix: store original config in constructor; override `reconnectBang()` to recreate `_driverPool`; wire `active` to call pool ping

**Auto-reconnect (1 test) — mysql2-adapter.ts**

- "execute after disconnect reconnects" — `_checkoutConn()` throws when pool is null; needs lazy reconnect via stored config

**Session variable wiring cluster (6 tests) — mysql2-adapter.ts newClient/pool.on('connection')**

- "wait timeout as string" / "wait timeout as url" — parse `wait_timeout` from config; emit `SET SESSION wait_timeout = N` in `pool.on('connection')`
- "mysql default in strict mode" / "mysql strict mode disabled" / "mysql strict mode specified default" — implement `configureConnection()` to set `sql_mode` based on `strict:` config key
- "mysql sql mode variable overrides strict mode" / "mysql set session variable" / "mysql set session variable to default" — wire `variables` hash into `pool.on('connection')` as `SET SESSION key = value`

**Flags cluster (2 tests) — pool model limitation**

- "passing arbitrary flags to adapter" / "passing flags by array to adapter" — pool model has no single `raw_connection`; would need a test accessor or expose `query_options` from pool

**Infrastructure gaps (2 tests)**

- "collation connection is configured" — needs second adapter (ARUnit2Model pattern); add `MYSQL_TEST_URL2` env var + second adapter to test-helper.ts
- "logs name rename column for alter" — `renameColumnForAlter()` returns SQL fragment; needs to fire `sql.active_record` notification with name "SCHEMA" in the CHANGE-column fallback path

## New infrastructure shipped (reusable for other mysql tests)

- `DatabaseVersionError` in errors.ts
- `getFullVersion()` / `getDatabaseVersion()` / `databaseVersion` getter on AbstractMysqlAdapter
- `showVariable()` via `schemaQuery()` with StatementInvalid rescue
- `disconnectBang()` on Mysql2Adapter with full teardown + `_endingPool` drain tracking
  </content>
  </invoke>
