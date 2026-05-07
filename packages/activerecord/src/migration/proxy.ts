/**
 * MigrationProxy — defers loading of actual migration classes until needed.
 *
 * Mirrors: ActiveRecord::MigrationProxy (defined in migration.rb,
 * mapped to deprecator.rb by the api:compare extractor)
 *
 * Node-only: uses node:module (createRequire) for synchronous file loading,
 * matching Rails' synchronous load_migration. Import via
 * @blazetrails/activerecord/migration/proxy (not the package root).
 */
import { createRequire } from "node:module";
import { getPath } from "@blazetrails/activesupport";

export class MigrationProxy {
  name: string;
  version: string;
  filename: string;
  scope: string;

  private _migration: object | null = null;

  constructor(name: string, version: string, filename: string, scope: string) {
    this.name = name;
    this.version = version;
    this.filename = filename;
    this.scope = scope;
  }

  basename(): string {
    return getPath().basename(this.filename);
  }

  migrate(direction: "up" | "down"): Promise<void> {
    return (this.migration() as { migrate(d: "up" | "down"): Promise<void> }).migrate(direction);
  }

  announce(message: string): void {
    (this.migration() as { announce(msg: string): void }).announce(message);
  }

  write(text = ""): void {
    (this.migration() as { write(t: string): void }).write(text);
  }

  get disableDdlTransaction(): boolean {
    return !!(this.migration() as { disableDdlTransaction?: boolean }).disableDdlTransaction;
  }

  /** @internal */
  migration(): object {
    this._migration ??= this.loadMigration();
    return this._migration;
  }

  /** @internal */
  loadMigration(): object {
    const req = createRequire(import.meta.url);
    delete req.cache[req.resolve(this.filename)];
    const mod = req(this.filename) as Record<string, new (name: string, version: string) => object>;
    const klass = mod[this.name] ?? mod.default;
    if (typeof klass !== "function") {
      throw new Error(
        `Migration ${this.name} could not be loaded from ${this.filename}: ` +
          `no export named "${this.name}" or "default" found`,
      );
    }
    return new (klass as new (name: string, version: string) => object)(this.name, this.version);
  }
}
