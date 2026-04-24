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
  fn: () => T | Promise<T>,
): Promise<{ result: T; queries: [string, unknown[]][] }> {
  return ExplainRegistry.collectingQueries(fn);
}

/**
 * Run EXPLAIN against each captured [sql, binds] pair and return a
 * formatted string ready to be logged.
 *
 * Mirrors: ActiveRecord::Explain#exec_explain
 */
export async function execExplain(
  modelClass: typeof Base,
  queries: [string, unknown[]][],
  options: ExplainOption[] = [],
): Promise<string> {
  const adapter = modelClass.adapter as any;
  if (typeof adapter?.explain !== "function") return "EXPLAIN not supported by this adapter";

  const clause =
    typeof adapter.buildExplainClause === "function"
      ? adapter.buildExplainClause(options)
      : "EXPLAIN for:";

  const parts: string[] = [];
  for (const [sql, binds] of queries) {
    let msg = `${clause} ${sql}`;
    if (binds.length > 0) msg += ` ${JSON.stringify(binds)}`;
    const plan = await adapter.explain(sql, binds, options);
    parts.push(`${msg}\n${plan}`);
  }
  return parts.join("\n\n");
}
