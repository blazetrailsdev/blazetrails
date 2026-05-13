import {
  insertFixturesSet,
  type DatabaseStatementsHost,
} from "../connection-adapters/abstract/database-statements.js";
import type { DatabaseAdapter } from "../adapter.js";
import type { Base } from "../base.js";
import type { Quoting } from "../connection-adapters/abstract/quoting-interface.js";
import { singularize } from "@blazetrails/activesupport";

const FIXTURE_MAX_ID = 2 ** 30 - 1;

// CRC32 lookup table (polynomial 0xedb88320). For ASCII labels this produces values
// identical to Ruby's Zlib.crc32(label) % MAX_ID, matching Rails' FixtureSet.identify.
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(str: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc = CRC32_TABLE[(crc ^ str.charCodeAt(i)) & 0xff]! ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0) % FIXTURE_MAX_ID;
}

/** Returns the deterministic integer ID for a fixture label. Mirrors Rails' FixtureSet.identify. */
export function fixtureId(label: string): number {
  return crc32(label);
}

const REF_TAG = Symbol("fixture-ref");

export interface FixtureRef {
  readonly [REF_TAG]: true;
  readonly tableName: string;
  readonly fixtureName: string;
}

/**
 * Cross-batch cross-reference sentinel. Resolves to the fixture's deterministic ID at insert time.
 * `tableName` is stored for readability and future validation; resolution uses only `fixtureName`.
 */
export function ref(tableName: string, fixtureName: string): FixtureRef {
  return { [REF_TAG]: true, tableName, fixtureName };
}

/** @internal */
export function isFixtureRef(v: unknown): v is FixtureRef {
  return typeof v === "object" && v !== null && REF_TAG in v;
}

// --- Phase 1b: tableName → ModelClass registry ---

const tableRegistry = new Map<string, BaseClass>();

/** @internal Exposed for testing. */
export function resolveModelForTable(tableName: string): BaseClass | undefined {
  return tableRegistry.get(tableName);
}

/** @internal */
export function clearTableRegistry(): void {
  tableRegistry.clear();
}

// --- Phase 1b: HABTM join-table detection ---

/**
 * Given a join-table name like "developers_projects", returns [singularA, singularB] if both
 * corresponding plural table names are registered, otherwise null.
 * @internal
 */
function detectHabtmParts(tableName: string): [string, string] | null {
  const parts = tableName.split("_");
  for (let i = 1; i < parts.length; i++) {
    const left = parts.slice(0, i).join("_");
    const right = parts.slice(i).join("_");
    if (tableRegistry.has(left) && tableRegistry.has(right)) {
      return [left, right];
    }
  }
  return null;
}

// --- Phase 1b: polymorphic belongs_to detection ---

interface PolymorphicBelongsTo {
  typeColumn: string;
  idColumn: string;
  modelClass: BaseClass;
}

function findPolymorphicRef(modelClass: BaseClass, colName: string): PolymorphicBelongsTo | null {
  const reflections: Record<string, any> = (modelClass as any)._reflections ?? {};
  const refl = reflections[colName];
  if (!refl || refl.macro !== "belongsTo" || !refl.isPolymorphic?.()) return null;
  return {
    typeColumn: `${colName}_type`,
    idColumn: `${colName}_id`,
    modelClass,
  };
}

type BaseClass = typeof Base;
type FixtureAttrs = Record<string, unknown>;
type InsertHost = DatabaseStatementsHost &
  Pick<Quoting, "quote" | "quoteTableName" | "quoteColumnName">;

/**
 * Inserts fixture rows for a model and returns persisted instances keyed by label.
 *
 * IDs are deterministic: same label → same ID across test runs, enabling cross-batch
 * FK references via `ref(tableName, label)` without insertion-order coupling.
 *
 * Phase 1b ergonomics (convention-over-config, additive):
 * - HABTM join tables: string values for `a_id`/`b_id` columns auto-resolve via fixtureId()
 *   when the table name matches the `a_b` pattern and both `a` and `b` are registered.
 * - Polymorphic refs: `{ taggable: postInstance }` expands to `taggable_type`/`taggable_id`
 *   when a polymorphic `belongsTo :taggable` reflection exists on the model.
 * - `ref(tableName, label)` works without re-passing the ModelClass once any defineFixtures
 *   call for that table has registered it.
 */
export async function defineFixtures<T extends BaseClass, K extends string>(
  adapter: DatabaseAdapter,
  ModelClass: T,
  fixtures: Record<K, FixtureAttrs>,
): Promise<{ [P in K]: InstanceType<T> }> {
  const tableName = ModelClass.tableName;
  const pk = ModelClass.primaryKey;
  if (Array.isArray(pk)) {
    throw new Error(
      `defineFixtures: composite primary keys are not supported (model: ${ModelClass.name}, pk: [${pk.join(", ")}])`,
    );
  }
  const pkCol = pk;

  // Register this model in the tableName registry (Phase 1b).
  tableRegistry.set(tableName, ModelClass);

  const habtmParts = detectHabtmParts(tableName);

  const labels = Object.keys(fixtures) as K[];

  // Build rows with deterministic IDs and resolved references
  const rows: FixtureAttrs[] = [];
  for (const label of labels) {
    const attrs = fixtures[label];
    const id = fixtureId(label);
    const row: FixtureAttrs = { [pkCol]: id };

    for (const [col, val] of Object.entries(attrs)) {
      if (col === pkCol) continue; // deterministic ID wins; caller must not override it

      if (isFixtureRef(val)) {
        row[col] = fixtureId(val.fixtureName);
        continue;
      }

      // Polymorphic belongs_to expansion: { taggable: instance } → taggable_type + taggable_id
      const poly = findPolymorphicRef(ModelClass, col);
      if (poly && val !== null && typeof val === "object") {
        const instance = val as FixtureAttrs;
        const instancePk = (instance.constructor as any)?.primaryKey ?? pkCol;
        const instanceClass = (instance as any).constructor as BaseClass | undefined;
        row[poly.idColumn] = instance[typeof instancePk === "string" ? instancePk : pkCol];
        row[poly.typeColumn] = instanceClass?.name ?? String((instance as any).constructor);
        continue;
      }

      // HABTM auto-resolution: string label values for `a_id`/`b_id` columns auto-resolve.
      // "developers_projects" → left="developers", right="projects"; FK cols are
      // "developer_id" and "project_id" (naive singularize: strip trailing "s").
      if (habtmParts && typeof val === "string") {
        const [left, right] = habtmParts;
        const leftSingular = singularize(left);
        const rightSingular = singularize(right);
        if (col === `${leftSingular}_id` || col === `${rightSingular}_id`) {
          row[col] = fixtureId(val);
          continue;
        }
      }

      if (val !== null && typeof val === "object" && pkCol in val) {
        // Model instance (or any object with the PK): extract the PK value.
        row[col] = (val as FixtureAttrs)[pkCol];
      } else {
        row[col] = val;
      }
    }
    rows.push(row);
  }

  // Mirrors Rails: pass tableName as tablesToDelete so rows are replaced, not appended.
  await insertFixturesSet.call(adapter as unknown as InsertHost, { [tableName]: rows }, [
    tableName,
  ]);

  // Reload persisted instances so AR attribute casting is applied
  const result = {} as { [P in K]: InstanceType<T> };
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!;
    const id = (rows[i] as FixtureAttrs)[pkCol];
    const record = await (ModelClass as any).findBy({ [pkCol]: id });
    if (!record) {
      throw new Error(
        `defineFixtures: inserted fixture "${label}" not found after insert (table: ${tableName}, ${pkCol}: ${id})`,
      );
    }
    result[label] = record as InstanceType<T>;
  }
  return result;
}
