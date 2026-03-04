/**
 * Database adapter interface — pluggable backends.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::AbstractAdapter
 */
export interface DatabaseAdapter {
  /**
   * Execute a SQL query and return rows.
   */
  execute(sql: string, binds?: unknown[]): Promise<Record<string, unknown>[]>;

  /**
   * Execute a SQL statement that modifies data (INSERT/UPDATE/DELETE).
   * Returns the number of affected rows (or the inserted ID for INSERT).
   */
  executeMutation(sql: string, binds?: unknown[]): Promise<number>;

  /**
   * Begin a transaction.
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit a transaction.
   */
  commit(): Promise<void>;

  /**
   * Rollback a transaction.
   */
  rollback(): Promise<void>;

  /**
   * Create a savepoint.
   */
  createSavepoint(name: string): Promise<void>;

  /**
   * Release a savepoint.
   */
  releaseSavepoint(name: string): Promise<void>;

  /**
   * Rollback to a savepoint.
   */
  rollbackToSavepoint(name: string): Promise<void>;
}

/**
 * In-memory adapter for testing — stores data in Maps.
 */
export class MemoryAdapter implements DatabaseAdapter {
  private tables = new Map<string, Record<string, unknown>[]>();
  private autoIncrements = new Map<string, number>();

  async execute(sql: string): Promise<Record<string, unknown>[]> {
    // COUNT queries (must be checked before general SELECT)
    const countMatch = sql.match(
      /SELECT\s+COUNT\(\*\)\s*(?:AS\s+\w+\s+)?FROM\s+"(\w+)"(?:\s+WHERE\s+(.+?))?$/i
    );
    if (countMatch) {
      const [, tableName, where] = countMatch;
      let rows = [...(this.tables.get(tableName) ?? [])];
      if (where) {
        rows = rows.filter((row) => this.evaluateWhere(row, where));
      }
      return [{ count: rows.length }];
    }

    // Simple SQL parser for SELECT queries against in-memory store
    const selectMatch = sql.match(
      /SELECT\s+(.+?)\s+FROM\s+"(\w+)"(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?(?:\s+OFFSET\s+(\d+))?$/i
    );

    if (selectMatch) {
      const [, projections, tableName, where, orderBy, limit, offset] =
        selectMatch;
      let rows = [...(this.tables.get(tableName) ?? [])];

      if (where) {
        rows = rows.filter((row) => this.evaluateWhere(row, where));
      }

      if (orderBy) {
        rows = this.applyOrder(rows, orderBy);
      }

      if (offset) {
        rows = rows.slice(parseInt(offset));
      }

      if (limit) {
        rows = rows.slice(0, parseInt(limit));
      }

      if (projections.trim() !== "*") {
        const cols = projections.split(",").map((c) => {
          const parts = c.trim().replace(/"/g, "").split(".");
          return parts[parts.length - 1];
        });
        rows = rows.map((row) => {
          const result: Record<string, unknown> = {};
          for (const col of cols) {
            result[col] = row[col];
          }
          return result;
        });
      }

      return rows;
    }

    return [];
  }

  async executeMutation(sql: string): Promise<number> {
    // INSERT
    const insertMatch = sql.match(
      /INSERT\s+INTO\s+"(\w+)"\s+\((.+?)\)\s+VALUES\s+\((.+?)\)/i
    );
    if (insertMatch) {
      const [, tableName, colStr, valStr] = insertMatch;
      const columns = colStr.split(",").map((c) => c.trim().replace(/"/g, ""));
      const values = this.parseValues(valStr);

      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }

      const id = (this.autoIncrements.get(tableName) ?? 0) + 1;
      this.autoIncrements.set(tableName, id);

      const row: Record<string, unknown> = { id };
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = values[i];
      }
      this.tables.get(tableName)!.push(row);
      return id;
    }

    // UPDATE
    const updateMatch = sql.match(
      /UPDATE\s+"(\w+)"\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i
    );
    if (updateMatch) {
      const [, tableName, setStr, where] = updateMatch;
      const rows = this.tables.get(tableName) ?? [];
      let affected = 0;
      const assignments = this.parseAssignments(setStr);

      for (const row of rows) {
        if (!where || this.evaluateWhere(row, where)) {
          for (const [col, val] of assignments) {
            row[col] = val;
          }
          affected++;
        }
      }
      return affected;
    }

    // DELETE
    const deleteMatch = sql.match(
      /DELETE\s+FROM\s+"(\w+)"(?:\s+WHERE\s+(.+))?$/i
    );
    if (deleteMatch) {
      const [, tableName, where] = deleteMatch;
      const rows = this.tables.get(tableName) ?? [];
      if (!where) {
        const count = rows.length;
        this.tables.set(tableName, []);
        return count;
      }
      const before = rows.length;
      this.tables.set(
        tableName,
        rows.filter((row) => !this.evaluateWhere(row, where))
      );
      return before - (this.tables.get(tableName)?.length ?? 0);
    }

    return 0;
  }

  async beginTransaction(): Promise<void> {}
  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  async createSavepoint(_name: string): Promise<void> {}
  async releaseSavepoint(_name: string): Promise<void> {}
  async rollbackToSavepoint(_name: string): Promise<void> {}

  // -- Helpers --

  private evaluateWhere(
    row: Record<string, unknown>,
    where: string
  ): boolean {
    // Handle AND conditions
    const andParts = where.split(/\s+AND\s+/i);
    return andParts.every((part) => this.evaluateCondition(row, part.trim()));
  }

  private evaluateCondition(
    row: Record<string, unknown>,
    condition: string
  ): boolean {
    // IS NULL
    const isNullMatch = condition.match(/"?(\w+)"?\."?(\w+)"?\s+IS\s+NULL/i);
    if (isNullMatch) {
      return row[isNullMatch[2]] === null || row[isNullMatch[2]] === undefined;
    }

    // IS NOT NULL
    const isNotNullMatch = condition.match(/"?(\w+)"?\."?(\w+)"?\s+IS\s+NOT\s+NULL/i);
    if (isNotNullMatch) {
      return row[isNotNullMatch[2]] !== null && row[isNotNullMatch[2]] !== undefined;
    }

    // column = value
    const eqMatch = condition.match(
      /"?(\w+)"?\."?(\w+)"?\s*=\s*(.+)/
    );
    if (eqMatch) {
      const [, , col, rawVal] = eqMatch;
      const val = this.parseSingleValue(rawVal.trim());
      return row[col] == val;
    }

    // column != value
    const neqMatch = condition.match(
      /"?(\w+)"?\."?(\w+)"?\s*!=\s*(.+)/
    );
    if (neqMatch) {
      const [, , col, rawVal] = neqMatch;
      const val = this.parseSingleValue(rawVal.trim());
      return row[col] != val;
    }

    // column > value
    const gtMatch = condition.match(
      /"?(\w+)"?\."?(\w+)"?\s*>\s*(.+)/
    );
    if (gtMatch) {
      const [, , col, rawVal] = gtMatch;
      const val = this.parseSingleValue(rawVal.trim());
      return Number(row[col]) > Number(val);
    }

    // column < value
    const ltMatch = condition.match(
      /"?(\w+)"?\."?(\w+)"?\s*<\s*(.+)/
    );
    if (ltMatch) {
      const [, , col, rawVal] = ltMatch;
      const val = this.parseSingleValue(rawVal.trim());
      return Number(row[col]) < Number(val);
    }

    return true;
  }

  private parseSingleValue(raw: string): unknown {
    if (raw === "NULL") return null;
    if (raw.startsWith("'") && raw.endsWith("'")) {
      return raw.slice(1, -1).replace(/''/g, "'");
    }
    const num = Number(raw);
    if (!isNaN(num)) return num;
    return raw;
  }

  private parseValues(valStr: string): unknown[] {
    const values: unknown[] = [];
    let current = "";
    let inString = false;

    for (let i = 0; i < valStr.length; i++) {
      const ch = valStr[i];
      if (ch === "'" && !inString) {
        inString = true;
        current += ch;
      } else if (ch === "'" && inString) {
        if (valStr[i + 1] === "'") {
          current += "''";
          i++;
        } else {
          inString = false;
          current += ch;
        }
      } else if (ch === "," && !inString) {
        values.push(this.parseSingleValue(current.trim()));
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) {
      values.push(this.parseSingleValue(current.trim()));
    }

    return values;
  }

  private parseAssignments(setStr: string): [string, unknown][] {
    const results: [string, unknown][] = [];
    const parts = setStr.split(",");
    for (const part of parts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) continue;
      const col = part
        .slice(0, eqIdx)
        .trim()
        .replace(/"/g, "")
        .split(".")
        .pop()!;
      const val = this.parseSingleValue(part.slice(eqIdx + 1).trim());
      results.push([col, val]);
    }
    return results;
  }

  private applyOrder(
    rows: Record<string, unknown>[],
    orderBy: string
  ): Record<string, unknown>[] {
    const parts = orderBy.split(",").map((p) => {
      const trimmed = p.trim();
      const descMatch = trimmed.match(/(.+?)\s+DESC/i);
      const ascMatch = trimmed.match(/(.+?)\s+ASC/i);
      const col = (descMatch?.[1] ?? ascMatch?.[1] ?? trimmed)
        .replace(/"/g, "")
        .split(".")
        .pop()!;
      const dir = descMatch ? "desc" : "asc";
      return { col, dir };
    });

    return rows.sort((a, b) => {
      for (const { col, dir } of parts) {
        const aVal = a[col];
        const bVal = b[col];
        if (aVal === bVal) continue;
        const cmp =
          aVal === null || aVal === undefined
            ? -1
            : bVal === null || bVal === undefined
              ? 1
              : aVal < bVal
                ? -1
                : 1;
        return dir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }
}
