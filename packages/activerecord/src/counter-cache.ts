import type { Base } from "./base.js";
import { quoteIdentifier } from "./connection-adapters/abstract/quoting.js";

/**
 * Counter cache operations for ActiveRecord models.
 *
 * Mirrors: ActiveRecord::CounterCache
 */

/**
 * Increment counter columns for a record by primary key.
 *
 * Mirrors: ActiveRecord::CounterCache::ClassMethods#increment_counter
 */
export async function incrementCounter(
  modelClass: typeof Base,
  attribute: string,
  id: unknown,
  by: number = 1,
  options?: { touch?: boolean | string | string[] },
): Promise<number> {
  const table = modelClass.arelTable;
  const touchClause = buildTouchClause(options?.touch);
  const quotedAttr = quoteIdentifier(attribute);
  const sql = `UPDATE ${quoteIdentifier(table.name)} SET ${quotedAttr} = COALESCE(${quotedAttr}, 0) + ${by}${touchClause} WHERE ${(modelClass as any)._buildPkWhere(id)}`;
  return modelClass.adapter.executeMutation(sql);
}

/**
 * Decrement counter columns for a record by primary key.
 *
 * Mirrors: ActiveRecord::CounterCache::ClassMethods#decrement_counter
 */
export async function decrementCounter(
  modelClass: typeof Base,
  attribute: string,
  id: unknown,
  by: number = 1,
  options?: { touch?: boolean | string | string[] },
): Promise<number> {
  return incrementCounter(modelClass, attribute, id, -by, options);
}

/**
 * Update counter columns for one or more records.
 *
 * Mirrors: ActiveRecord::CounterCache::ClassMethods#update_counters
 */
export async function updateCounters(
  modelClass: typeof Base,
  id: unknown | unknown[],
  counters: Record<string, number>,
  options?: { touch?: boolean | string | string[] },
): Promise<number> {
  const table = modelClass.arelTable;
  const touchClause = buildTouchClause(options?.touch);
  const setClause =
    Object.entries(counters)
      .map(([attr, amount]) => {
        const q = quoteIdentifier(attr);
        return `${q} = COALESCE(${q}, 0) + ${amount}`;
      })
      .join(", ") + touchClause;
  const tableName = quoteIdentifier(table.name);
  if (Array.isArray(modelClass.primaryKey)) {
    const tuples =
      Array.isArray(id) && Array.isArray(id[0]) ? (id as unknown[][]) : [id as unknown[]];
    const whereParts = tuples.map((t) => `(${(modelClass as any)._buildPkWhere(t)})`);
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereParts.join(" OR ")}`;
    return modelClass.adapter.executeMutation(sql);
  }
  const ids = Array.isArray(id) ? id : [id];
  const idList = ids
    .map((i) => (typeof i === "number" ? String(i) : `'${String(i).replace(/'/g, "''")}'`))
    .join(", ");
  const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${quoteIdentifier(modelClass.primaryKey as string)} IN (${idList})`;
  return modelClass.adapter.executeMutation(sql);
}

/**
 * Reset counter caches by recounting the actual associated records.
 *
 * Mirrors: ActiveRecord::CounterCache::ClassMethods#reset_counters
 */
export async function resetCounters(
  modelClass: typeof Base,
  id: unknown,
  ...counterNames: string[]
): Promise<void> {
  const record = await modelClass.find(id);
  const assocDefs = (modelClass as any)._associations as
    | Array<{ type: string; name: string; options: any }>
    | undefined;
  const hasManyAssocs = assocDefs?.filter((a) => a.type === "hasMany") ?? [];
  const { resolveCounterColumn, countHasMany } = await import("./associations.js");
  for (const counterName of counterNames) {
    let assoc = hasManyAssocs.find((a) => a.name === counterName);
    let counterColumn: string;

    if (assoc) {
      counterColumn = resolveCounterColumn(modelClass, assoc, counterName);
    } else {
      if (counterName.endsWith("_count")) {
        assoc = hasManyAssocs.find((a) => a.name === counterName.slice(0, -6));
      }
      if (!assoc) {
        for (const candidate of hasManyAssocs) {
          const col = resolveCounterColumn(modelClass, candidate, candidate.name);
          if (col === counterName) {
            assoc = candidate;
            break;
          }
        }
      }
      if (!assoc) {
        throw new Error(
          `'${counterName}' is not a valid counter name or hasMany association on ${modelClass.name}`,
        );
      }
      counterColumn = resolveCounterColumn(modelClass, assoc, assoc.name);
    }

    const count = await countHasMany(record, assoc.name, assoc.options);
    await record.updateColumn(counterColumn, count);
  }
}

function buildTouchClause(touch?: boolean | string | string[]): string {
  if (!touch) return "";
  if (touch === true) return `, ${quoteIdentifier("updated_at")} = CURRENT_TIMESTAMP`;
  const cols = Array.isArray(touch) ? touch : [touch];
  if (cols.length === 0) return "";
  return cols.map((c) => `, ${quoteIdentifier(c)} = CURRENT_TIMESTAMP`).join("");
}
