import { ExplainRegistry } from "./explain-registry.js";
import type { Base } from "./base.js";
import type { ExplainOption } from "./adapter.js";

/**
 * Explain module — entry points for collecting queries and running EXPLAIN.
 *
 * Mirrors: ActiveRecord::Explain
 */

/**
 * Execute the block with query collection enabled. Queries are captured by
 * the subscriber and returned along with the block's result.
 *
 * Mirrors: ActiveRecord::Explain#collecting_queries_for_explain
 */
export async function collectingQueriesForExplain<T>(
  fn: () => Promise<T>,
): Promise<{ value: T; queries: [string, unknown[]][] }> {
  return ExplainRegistry.collectingQueries(fn);
}

/**
 * Run EXPLAIN against each captured [sql, binds] pair and return a
 * formatted string ready to be logged.
 *
 * Delegates to the model's Relation for bind rendering so output is
 * consistent with Relation#explain — including typeCast and binary handling.
 *
 * Mirrors: ActiveRecord::Explain#exec_explain
 */
export async function execExplain(
  modelClass: typeof Base,
  queries: [string, unknown[]][],
  options: ExplainOption[] = [],
): Promise<string> {
  // Delegate to Relation#_execExplain which handles typeCast, binary binds,
  // and adapter-specific buildExplainClause — reusing that logic avoids
  // duplicating the JSON.stringify / typeCast edge cases.
  return (modelClass as any).all()._execExplain(queries, options);
}

/**
 * Render a single bind parameter as [name, value] for EXPLAIN output.
 * Binary values are replaced with a byte-count summary.
 *
 * Mirrors: ActiveRecord::Explain#render_bind (private)
 *
 * @internal
 */
export function renderBind(connection: any, attr: unknown): [string | null, unknown] {
  if (attr && typeof attr === "object" && "type" in attr && "value" in attr) {
    const a = attr as { name?: string; type?: any; value?: unknown; valueForDatabase?: unknown };
    const isBinary = a.type?.binary?.() ?? a.type?.isBinary?.() ?? false;
    if (isBinary && a.value != null) {
      const raw =
        typeof a.valueForDatabase === "function" ? a.valueForDatabase() : a.valueForDatabase;
      const bytes = raw != null ? String(raw).length : 0;
      return [a.name ?? null, `<${bytes} bytes of binary data>`];
    }
    const typeCasted = connection?.typeCast?.(a.valueForDatabase) ?? a.valueForDatabase ?? a.value;
    return [a.name ?? null, typeCasted];
  }
  const value = connection?.typeCast?.(attr) ?? attr;
  return [null, value];
}

/**
 * Build the EXPLAIN prefix clause. Delegates to the connection's
 * buildExplainClause method if available, otherwise returns "EXPLAIN for:".
 *
 * Mirrors: ActiveRecord::Explain#build_explain_clause (private)
 *
 * @internal
 */
export function buildExplainClause(connection: any, options: ExplainOption[] = []): string {
  if (connection && typeof connection.buildExplainClause === "function") {
    return connection.buildExplainClause(options);
  }
  return "EXPLAIN for:";
}
