import type { Node } from "./nodes/node.js";
import type { InsertManager } from "./insert-manager.js";
import type { UpdateManager } from "./update-manager.js";
import type { DeleteManager } from "./delete-manager.js";

/**
 * Crud — mixed into query-like managers to build CRUD statements.
 *
 * Mirrors: Arel::Crud
 */
export interface Crud {
  compileInsert(values: [Node, unknown][]): InsertManager;
  createInsert(): InsertManager;
  compileUpdate(
    values: [Node, unknown][] | string | Node,
    key?: Node | null,
    havingClause?: Node | null,
    groupValuesColumns?: Node[],
  ): UpdateManager;
  compileDelete(
    key?: Node | null,
    havingClause?: Node | null,
    groupValuesColumns?: Node[],
  ): DeleteManager;
}
