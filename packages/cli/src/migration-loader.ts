import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { MigrationProxy } from "@rails-ts/activerecord";

const MIGRATION_FILE_PATTERN = /^(\d+)-(.+)\.(ts|js)$/;

/**
 * Discover migration files from a directory and return MigrationProxy objects
 * compatible with the Migrator class.
 *
 * Migration files are expected to match the pattern: {timestamp}-{name}.ts (or .js)
 * e.g., 20260318120000-create-users.ts
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

async function loadMigrationClass(
  filePath: string,
): Promise<new () => { run(adapter: any, direction: "up" | "down"): Promise<void> }> {
  let mod: any;
  try {
    mod = await import(pathToFileURL(filePath).href);
  } catch (error: any) {
    if (path.extname(filePath) === ".ts") {
      const enhanced = new Error(
        `Failed to load TypeScript migration "${filePath}". ` +
          `Ensure a TypeScript loader (tsx, ts-node) is configured, ` +
          `or compile migrations to .js first.`,
      );
      (enhanced as any).cause = error;
      throw enhanced;
    }
    throw error;
  }

  // Try default export first, then find the first class export
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
