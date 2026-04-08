/**
 * Tracks table aliases during join construction to avoid conflicts.
 *
 * Mirrors: ActiveRecord::Associations::AliasTracker
 */
import { Table } from "@blazetrails/arel";

const DEFAULT_TABLE_ALIAS_LENGTH = 63;

export class AliasTracker {
  readonly aliases: Map<string, number>;
  private _tableAliasLength: number;

  constructor(tableAliasLength?: number, aliases?: Map<string, number>) {
    this._tableAliasLength = tableAliasLength ?? DEFAULT_TABLE_ALIAS_LENGTH;
    this.aliases = aliases ?? new Map();
  }

  static create(
    pool: any,
    initialTable: string,
    joins: any[],
    aliases?: Map<string, number>,
  ): AliasTracker {
    const tableAliasLength =
      typeof pool?.withConnection === "function"
        ? DEFAULT_TABLE_ALIAS_LENGTH
        : (pool?.tableAliasLength ?? DEFAULT_TABLE_ALIAS_LENGTH);

    if (joins.length === 0) {
      if (!aliases) aliases = new Map();
    } else if (aliases) {
      const base = new Map(aliases);
      aliases = new Map();
      for (const [k, v] of base) aliases.set(k, v);
      // Lazy-initialize counts for unknown tables from joins
      const origGet = aliases.get.bind(aliases);
      aliases.get = (key: string) => {
        if (aliases!.has(key)) return origGet(key);
        const count = AliasTracker.initialCountFor(key, joins);
        aliases!.set(key, count);
        return count;
      };
    } else {
      aliases = new Map();
      const origGet = aliases.get.bind(aliases);
      aliases.get = (key: string) => {
        if (aliases!.has(key)) return origGet(key);
        const count = AliasTracker.initialCountFor(key, joins);
        aliases!.set(key, count);
        return count;
      };
    }

    aliases.set(initialTable, 1);
    return new AliasTracker(tableAliasLength, aliases);
  }

  static initialCountFor(name: string, tableJoins: any[]): number {
    let count = 0;
    const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `JOIN(?:\\s+\\w+)?\\s+(?:\\S+\\s+)?(?:"?${nameEscaped}"?)\\s+ON`,
      "gi",
    );

    for (const join of tableJoins) {
      if (typeof join === "string") {
        const matches = join.match(pattern);
        count += matches ? matches.length : 0;
      } else if (join && typeof join === "object") {
        // Arel StringJoin — join.left is the SQL string
        const sql = join.left?.toString?.() ?? join.toString?.() ?? "";
        if (typeof sql === "string") {
          const matches = sql.match(pattern);
          count += matches ? matches.length : 0;
        }
        // Arel Join node — join.left is a Table
        if (join.left?.name === name) count += 1;
      }
    }

    return count;
  }

  aliasedTableFor(arelTable: Table | any, tableNameOrBlock?: string | (() => string)): Table | any {
    const tableName =
      typeof tableNameOrBlock === "string" ? tableNameOrBlock : (arelTable.name ?? arelTable);

    const count = this.aliases.get(tableName) ?? 0;
    if (count === 0) {
      this.aliases.set(tableName, 1);
      if (arelTable.name !== tableName) {
        return typeof arelTable.alias === "function" ? arelTable.alias(tableName) : arelTable;
      }
      return arelTable;
    }

    // Need an alias — use the block if provided, otherwise the table name
    const aliasCandidate = typeof tableNameOrBlock === "function" ? tableNameOrBlock() : tableName;
    const aliasedName = this._tableAliasFor(aliasCandidate);

    const newCount = (this.aliases.get(aliasedName) ?? 0) + 1;
    this.aliases.set(aliasedName, newCount);

    const finalName = newCount > 1 ? `${this._truncate(aliasedName)}_${newCount}` : aliasedName;

    return typeof arelTable.alias === "function" ? arelTable.alias(finalName) : finalName;
  }

  aliasFor(tableName: string): string {
    const count = this.aliases.get(tableName) ?? 0;
    if (count === 0) {
      this.aliases.set(tableName, 1);
      return tableName;
    }
    this.aliases.set(tableName, count + 1);
    return `${tableName}_${count}`;
  }

  private _tableAliasFor(tableName: string): string {
    return tableName.slice(0, this._tableAliasLength).replace(/\./g, "_");
  }

  private _truncate(name: string): string {
    return name.slice(0, this._tableAliasLength - 2);
  }
}
