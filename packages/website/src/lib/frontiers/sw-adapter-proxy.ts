/**
 * SqlJsAdapter-shaped async interface backed by the sandbox service worker.
 * DatabaseBrowser uses this to query schema/data when SQLite lives in the SW.
 */

import type { SwClient } from "./sw-client.js";

export class SwAdapterProxy {
  constructor(private client: SwClient) {}

  async getTables(): Promise<string[]> {
    const resp = await this.client.send<{ type: "db:tables"; tables: string[] }>({
      type: "db:tables",
    });
    return resp.tables;
  }

  async getColumns(
    table: string,
  ): Promise<Array<{ name: string; type: string; notnull: boolean; pk: boolean }>> {
    const resp = await this.client.send<{
      type: "db:columns";
      columns: Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
    }>({ type: "db:columns", table });
    return resp.columns;
  }

  async execRaw(sql: string): Promise<Array<{ columns: string[]; values: unknown[][] }>> {
    const resp = await this.client.send<{
      type: "db:query";
      results: Array<{ columns: string[]; values: unknown[][] }>;
    }>({ type: "db:query", sql });
    return resp.results;
  }

  async exec(command: string): Promise<{ success: boolean; output: string[]; exitCode: number }> {
    const resp = await this.client.send<{
      type: "exec";
      result: { success: boolean; output: string[]; exitCode: number };
    }>({ type: "exec", command });
    return resp.result;
  }

  async exportDB(): Promise<Uint8Array> {
    const resp = await this.client.send<{ type: "db:export"; data: Uint8Array }>({
      type: "db:export",
    });
    return resp.data;
  }

  async importDB(data: Uint8Array): Promise<void> {
    await this.client.send({ type: "db:import", data });
  }
}
