/**
 * Debug instrumentation for the join-model PG flake investigation.
 *
 * Emits a structured log line every time the test-adapter mutates its
 * shared module state, plus a snapshot of pg_tables before/after each
 * suspicious transition. Output is unconditional so CI captures it.
 *
 * Remove this file once the root cause is identified.
 */

let _seq = 0;
const _t0 = Date.now();

function ts(): string {
  return `t+${(Date.now() - _t0).toString().padStart(6, "0")}ms #${(++_seq).toString().padStart(5, "0")}`;
}

export function dbg(event: string, data?: Record<string, unknown>): void {
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[ARDBG ${ts()}] ${event}${payload}`);
}

export async function dbgPgTables(adapter: any, label: string): Promise<void> {
  if (adapter?.adapterName !== "postgres" && adapter?.inner?.adapterName !== "postgres") {
    return;
  }
  const inner = adapter.inner ?? adapter;
  try {
    const rows = await inner.execute(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename`,
    );
    const names = (rows as { tablename: string }[]).map((r) => r.tablename);
    dbg(`pgTables[${label}]`, { count: names.length, names });
  } catch (e: unknown) {
    dbg(`pgTables[${label}]:error`, { msg: (e as Error).message });
  }
}
