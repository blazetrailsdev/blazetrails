/**
 * Sync SqlJsAdapter-compatible wrapper over the async SwAdapterProxy.
 * Maintains cached tables/columns so DatabaseBrowser can use its
 * existing sync API without modification.
 */

import type { SwAdapterProxy } from "./sw-adapter-proxy.js";
import type { SwClient } from "./sw-client.js";
import type { SwBroadcast } from "./sw-protocol.js";

export class SyncSwAdapter {
  private _tables: string[] = [];
  private _columns = new Map<
    string,
    Array<{ name: string; type: string; notnull: boolean; pk: boolean }>
  >();
  private _listeners: Array<() => void> = [];
  private _unsubBroadcast: (() => void) | null = null;

  constructor(
    private proxy: SwAdapterProxy,
    client: SwClient,
  ) {
    this._unsubBroadcast = client.onBroadcast((msg: SwBroadcast) => {
      if (msg.type === "db:changed" || msg.type === "vfs:changed") {
        this._rehydrate();
      }
    });
  }

  async hydrate(): Promise<void> {
    this._tables = await this.proxy.getTables();
    this._columns.clear();
    for (const table of this._tables) {
      this._columns.set(table, await this.proxy.getColumns(table));
    }
    this._notify();
  }

  private async _rehydrate(): Promise<void> {
    this._tables = await this.proxy.getTables();
    this._columns.clear();
    for (const table of this._tables) {
      this._columns.set(table, await this.proxy.getColumns(table));
    }
    this._notify();
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }

  getTables(): string[] {
    return this._tables;
  }

  getColumns(table: string): Array<{ name: string; type: string; notnull: boolean; pk: boolean }> {
    return this._columns.get(table) ?? [];
  }

  execRaw(sql: string): Array<{ columns: string[]; values: unknown[][] }> {
    // Fire async query and trigger refresh when done
    void this.proxy.execRaw(sql).then((results) => {
      this._lastExecResult = results;
      this._notify();
    });
    return this._lastExecResult ?? [];
  }

  private _lastExecResult: Array<{ columns: string[]; values: unknown[][] }> | null = null;

  onChange(fn: () => void): () => void {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  dispose(): void {
    this._unsubBroadcast?.();
    this._listeners = [];
  }
}
