import { SchemaStatements } from "../abstract/schema-statements.js";

export class PostgreSQLSchemaStatements extends SchemaStatements {
  override async dropTable(...args: Parameters<SchemaStatements["dropTable"]>): Promise<void> {
    let tableNames: string[];
    let options: { ifExists?: boolean; force?: "cascade" } = {};
    const last = args[args.length - 1];
    if (last !== null && last !== undefined && typeof last === "object") {
      tableNames = args.slice(0, -1) as string[];
      options = last as { ifExists?: boolean; force?: "cascade" };
    } else {
      tableNames = args as string[];
    }
    const ifExists = options.ifExists ? " IF EXISTS" : "";
    const cascade = options.force === "cascade" ? " CASCADE" : "";
    for (const name of tableNames) {
      await this.adapter.executeMutation(`DROP TABLE${ifExists} ${this._qt(name)}${cascade}`);
    }
  }
}
