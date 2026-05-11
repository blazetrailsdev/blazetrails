/**
 * captureSql — subscribe to sql.active_record during a callback and return
 * the SQL strings emitted, without actually executing them against a real DB.
 *
 * Mirrors the setup/teardown stub pattern in Rails'
 * activerecord/test/cases/adapters/abstract_mysql_adapter/active_schema_test.rb:
 * the test monkey-patches `connection.execute` to instrument the SQL and
 * return it instead of running it.  We achieve the same effect here by
 * subscribing to the notification and collecting the payloads.
 *
 * Usage:
 *   const sqls = await captureSql(adapter, () => adapter.addIndex("t", "c"));
 *   expect(sqls[0]).toBe("CREATE INDEX ...");
 */

import { Notifications } from "@blazetrails/activesupport";

/**
 * Runs `fn` and returns every SQL string emitted via `sql.active_record`
 * during its execution.  Subscription is cleaned up afterward.
 * @internal
 */
export async function captureSql(fn: () => Promise<unknown>): Promise<string[]> {
  const sqls: string[] = [];
  const sub = Notifications.subscribe("sql.active_record", (event: any) => {
    const sql: unknown = event.payload?.sql;
    if (typeof sql === "string") sqls.push(sql);
  });
  try {
    await fn();
  } finally {
    Notifications.unsubscribe(sub);
  }
  return sqls;
}
