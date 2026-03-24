import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { MigrationProxy } from "@rails-ts/activerecord";

const MIGRATION_FILE_PATTERN = /^(\d+)-(.+)\.ts$/;

/**
 * Discover migration files from a directory and return MigrationProxy objects
 * compatible with the Migrator class.
 *
 * Migration files must be TypeScript (.ts). They are imported at runtime,
 * so the CLI must be run with a TypeScript loader (e.g., tsx).
 *
 * Files match: {timestamp}-{name}.ts (e.g., 20260318120000-create-users.ts)
 */
export async function discoverMigrations(migrationsDir: string): Promise<MigrationProxy[]> {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => MIGRATION_FILE_PATTERN.test(f))
    .sort();

  const proxies: MigrationProxy[] = [];

  for (const file of files) {
    const match = file.match(MIGRATION_FILE_PATTERN);
    if (!match) continue;

    const version = match[1];
    const name = match[2];
    const filePath = path.join(migrationsDir, file);

    proxies.push({
      version,
      name,
      filename: filePath,
      migration: () => {
        const loader = {
          async up(adapter: import("@rails-ts/activerecord").DatabaseAdapter): Promise<void> {
            const MigrationClass = await loadMigrationClass(filePath);
            const instance = new MigrationClass();
            await instance.run(adapter, "up");
          },
          async down(adapter: import("@rails-ts/activerecord").DatabaseAdapter): Promise<void> {
            const MigrationClass = await loadMigrationClass(filePath);
            const instance = new MigrationClass();
            await instance.run(adapter, "down");
          },
        };
        return loader;
      },
    });
  }

  return proxies;
}

function isMigrationClass(value: unknown): boolean {
  if (typeof value !== "function") return false;
  const proto = (value as any).prototype;
  return proto && typeof proto.run === "function";
}

async function loadMigrationClass(
  filePath: string,
): Promise<new () => { run(adapter: any, direction: "up" | "down"): Promise<void> }> {
  let mod: any;
  try {
    mod = await import(pathToFileURL(filePath).href);
  } catch (error: any) {
    const enhanced = new Error(
      `Failed to load migration "${filePath}". ` +
        `The CLI imports .ts migrations directly — run with tsx ` +
        `(e.g., "npx tsx node_modules/.bin/rails-ts db migrate").`,
    );
    (enhanced as any).cause = error;
    throw enhanced;
  }

  if (isMigrationClass(mod.default)) {
    return mod.default;
  }

  for (const value of Object.values(mod)) {
    if (isMigrationClass(value)) {
      return value as any;
    }
  }

  // Fallback: first function export
  if (mod.default && typeof mod.default === "function") {
    return mod.default;
  }
  for (const value of Object.values(mod)) {
    if (typeof value === "function" && value !== mod.default) {
      return value as any;
    }
  }

  throw new Error(`No migration class found in ${filePath}`);
}
