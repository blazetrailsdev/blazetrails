/**
 * Browser-compatible CLI that mirrors @blazetrails/cli.
 *
 * Supports:
 *   trails new <name>
 *   generate migration <name> [columns...]
 *   generate model <name> [columns...]
 *   db:migrate, db:rollback, db:seed, db:setup, db:reset, db:drop
 *   db:migrate:status, db:migrate:redo, db:schema:dump
 */

import type { Runtime } from "./runtime.js";
import type { MigrationProxy, MigrationLike } from "@blazetrails/activerecord";
import { Migrator } from "@blazetrails/activerecord";
import { sampleDatabases } from "./sample-databases.js";
import { underscore, camelize, tableize, dasherize } from "@blazetrails/activesupport";

export interface CliResult {
  success: boolean;
  output: string[];
  exitCode: number;
}

// --- Arg parsing ---

interface ParsedInput {
  command: string;
  args: string[];
  opts: Record<string, string>;
}

function parseInput(input: string): ParsedInput {
  const parts = input.trim().split(/\s+/);
  const command = parts[0] ?? "";
  const args: string[] = [];
  const opts: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].startsWith("--")) {
      const key = parts[i].slice(2);
      const next = parts[i + 1];
      if (next && !next.startsWith("--")) {
        opts[key] = next;
        i++;
      } else opts[key] = "true";
    } else if (parts[i].startsWith("-")) {
      const key = parts[i].slice(1);
      const next = parts[i + 1];
      if (next && !next.startsWith("-")) {
        opts[key] = next;
        i++;
      } else opts[key] = "true";
    } else {
      args.push(parts[i]);
    }
  }
  return { command, args, opts };
}

// --- Migration discovery (mirrors cli/src/migration-loader.ts) ---

const MIGRATION_FILE_PATTERN = /^(\d+)[-_](.+)\.ts$/;

function discoverMigrations(runtime: Runtime): MigrationProxy[] {
  return runtime.vfs
    .list()
    .filter((f) => f.path.startsWith("db/migrations/"))
    .sort((a, b) => a.path.localeCompare(b.path))
    .flatMap((file) => {
      const basename = file.path.split("/").pop() ?? "";
      const match = basename.match(MIGRATION_FILE_PATTERN);
      if (!match) return [];
      return [
        {
          version: match[1],
          name: match[2],
          filename: file.path,
          migration: (): MigrationLike => ({
            async up(adapter) {
              const content = runtime.vfs.read(file.path)?.content;
              if (!content) throw new Error(`File not found: ${file.path}`);
              await runtime.executeCode(content);
              // Re-discover the registered migration and call its up
              const reg = runtime.getMigrations().find((m) => m.version === match![1]);
              if (reg) await reg.migration().up(adapter);
            },
            async down(adapter) {
              const content = runtime.vfs.read(file.path)?.content;
              if (!content) throw new Error(`File not found: ${file.path}`);
              await runtime.executeCode(content);
              const reg = runtime.getMigrations().find((m) => m.version === match![1]);
              if (reg) await reg.migration().down(adapter);
            },
          }),
        },
      ];
    });
}

// --- Generators (mirrors cli/src/generators/) ---

let _tsCounter = 0;
function migrationTimestamp(): string {
  const d = new Date();
  const base = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join("");
  // Append counter to avoid duplicates when generating multiple in the same second
  return base + String(_tsCounter++).padStart(2, "0");
}

function classify(name: string): string {
  return camelize(name.replace(/[-]/g, "_"));
}

type ColumnType =
  | "string"
  | "text"
  | "integer"
  | "float"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "timestamps"
  | "references"
  | "belongs_to";

function parseColumns(args: string[]): Array<{ name: string; type: ColumnType }> {
  return args
    .filter((a) => !a.startsWith("-") && a.includes(":"))
    .map((a) => {
      const [name, type] = a.split(":");
      return { name, type: type.replace(/\{[^}]*\}/, "") as ColumnType };
    });
}

function columnLine(col: { name: string; type: ColumnType }): string {
  if (col.type === "references" || col.type === "belongs_to") {
    return `      t.references("${col.name}", { foreignKey: true });`;
  }
  return `      t.${col.type}("${col.name}");`;
}

function generateMigrationFile(
  name: string,
  columns: Array<{ name: string; type: ColumnType }>,
): { filename: string; content: string; version: string } {
  const className = classify(name);
  const version = migrationTimestamp();
  const slug = dasherize(underscore(name));
  const filename = `db/migrations/${version}-${slug}.ts`;

  // Infer table name from "create_users" -> "users"
  const createMatch = name.match(/^create[_-]?(.+)$/i);
  const tableName = createMatch ? underscore(createMatch[1]) : underscore(name);
  const isCreate = !!createMatch;

  const colLines = columns.map(columnLine).join("\n");

  let upBody: string;
  let downBody: string;

  if (isCreate) {
    upBody = `    await this.createTable("${tableName}", (t) => {
${colLines}
      t.timestamps();
    });`;
    downBody = `    await this.dropTable("${tableName}");`;
  } else {
    upBody =
      columns.length > 0
        ? columns
            .map((c) => `    await this.addColumn("${tableName}", "${c.name}", "${c.type}");`)
            .join("\n")
        : "    // TODO: implement migration";
    downBody =
      columns.length > 0
        ? columns.map((c) => `    await this.removeColumn("${tableName}", "${c.name}");`).join("\n")
        : "    // TODO: implement rollback";
  }

  const content = `class ${className} extends Migration {
  version = "${version}";

  async up() {
${upBody}
  }

  async down() {
${downBody}
  }
}

runtime.registerMigration({
  version: "${version}",
  name: "${className}",
  migration: () => {
    const m = new ${className}();
    return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
  },
});
`;

  return { filename, content, version };
}

function generateModelFile(
  name: string,
  columns: Array<{ name: string; type: ColumnType }>,
): { filename: string; content: string } {
  const className = classify(name);
  const slug = dasherize(underscore(name));
  const filename = `app/models/${slug}.ts`;

  const attrLines = columns
    .map((c) => {
      if (c.type === "references" || c.type === "belongs_to") {
        return `    this.belongsTo("${c.name}");`;
      }
      return `    this.attribute("${c.name}", "${c.type}");`;
    })
    .join("\n");

  const staticBlock = attrLines ? `\n  static {\n${attrLines}\n  }\n` : "";

  const tableName = tableize(className);
  const content = `class ${className} extends Base {
  static tableName = "${tableName}";
${staticBlock}}
`;

  return { filename, content };
}

function generateAppScaffold(name: string): Array<{ path: string; content: string }> {
  return [
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    a { color: #0366d6; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
  </style>
</head>
<body>
  <h1>${name}</h1>
  <p>Welcome to your new Trails application.</p>
</body>
</html>
`,
    },
    {
      path: "app/main.ts",
      content: `// ${name} — main entry point
// Run this file or use the REPL to interact with your app.

// List all tables
const tables = adapter.getTables();
return tables.length > 0
  ? await adapter.execute(\`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_vfs_%' AND name NOT LIKE 'sqlite_%' ORDER BY name\`)
  : "${name} is ready. Run: scaffold Post title:string body:text";
`,
    },
    {
      path: "config/routes.ts",
      content: `// Define your application routes here.
// Example:
//   app.drawRoutes((r) => {
//     r.resources("posts");
//     r.get("/", { to: "home#index" });
//   });

// routes
`,
    },
    {
      path: "app/controllers/application-controller.ts",
      content: `class ApplicationController extends ActionController.Base {
  // Base controller — all controllers inherit from this.
}
`,
    },
    {
      path: "db/seeds.ts",
      content: `// Seed your database here.
//
// await adapter.executeMutation(
//   'INSERT INTO "users" ("name", "email", "created_at", "updated_at") VALUES (?, ?, datetime("now"), datetime("now"))',
//   ["Admin", "admin@example.com"]
// );
`,
    },
    {
      path: "queries/tables.sql",
      content: `-- List all tables and their row counts
SELECT name,
  (SELECT COUNT(*) FROM pragma_table_info(name)) as columns
FROM sqlite_master
WHERE type = 'table'
  AND name NOT LIKE '_vfs_%'
  AND name NOT LIKE 'sqlite_%'
ORDER BY name;
`,
    },
  ];
}

// --- Sample queries ---

function getSampleQueries(name: string): Array<{ path: string; content: string }> {
  const q = (file: string, sql: string) => ({ path: `queries/${name}/${file}`, content: sql });

  switch (name) {
    case "bookstore":
      return [
        q(
          "overview.sql",
          `-- Bookstore Overview
SELECT COUNT(*) as total_books, COUNT(DISTINCT author_id) as authors, ROUND(AVG(price), 2) as avg_price FROM "books";
SELECT genre, COUNT(*) as count, ROUND(AVG(price), 2) as avg_price FROM "books" GROUP BY genre ORDER BY count DESC`,
        ),
        q(
          "top-rated.sql",
          `-- Highest rated books
SELECT b."title", a."name" as author, ROUND(AVG(r."rating"), 1) as avg_rating, COUNT(r."id") as review_count
FROM "books" b
JOIN "authors" a ON b."author_id" = a."id"
JOIN "reviews" r ON r."book_id" = b."id"
GROUP BY b."id"
HAVING review_count >= 2
ORDER BY avg_rating DESC, review_count DESC`,
        ),
        q(
          "by-decade.sql",
          `-- Books by decade
SELECT (published_year / 10 * 10) || 's' as decade, COUNT(*) as books, GROUP_CONCAT(title, ', ') as titles
FROM "books"
GROUP BY decade
ORDER BY decade`,
        ),
        q(
          "prolific-authors.sql",
          `-- Authors ranked by book count and average rating
SELECT a."name", a."country", COUNT(b."id") as books,
  COALESCE(ROUND(AVG(r."rating"), 1), 0) as avg_rating
FROM "authors" a
LEFT JOIN "books" b ON b."author_id" = a."id"
LEFT JOIN "reviews" r ON r."book_id" = b."id"
GROUP BY a."id"
ORDER BY books DESC, avg_rating DESC`,
        ),
      ];
    case "music":
      return [
        q(
          "overview.sql",
          `-- Music Collection Overview
SELECT COUNT(DISTINCT artist_id) as artists, COUNT(*) as albums, SUM(t.tracks) as total_tracks
FROM "albums" a
LEFT JOIN (SELECT album_id, COUNT(*) as tracks FROM "tracks" GROUP BY album_id) t ON t.album_id = a."id";
SELECT a."name", COUNT(al."id") as albums FROM "artists" a JOIN "albums" al ON al."artist_id" = a."id" GROUP BY a."id" ORDER BY albums DESC`,
        ),
        q(
          "longest-tracks.sql",
          `-- Longest tracks
SELECT t."title" as track, al."title" as album, ar."name" as artist,
  t."duration_seconds" / 60 || ':' || SUBSTR('0' || (t."duration_seconds" % 60), -2) as duration
FROM "tracks" t
JOIN "albums" al ON t."album_id" = al."id"
JOIN "artists" ar ON al."artist_id" = ar."id"
ORDER BY t."duration_seconds" DESC
LIMIT 10`,
        ),
        q(
          "by-decade.sql",
          `-- Albums by decade
SELECT (released_year / 10 * 10) || 's' as decade, COUNT(*) as albums, GROUP_CONCAT(title, ', ') as titles
FROM "albums"
GROUP BY decade
ORDER BY decade`,
        ),
      ];
    case "national-parks":
      return [
        q(
          "overview.sql",
          `-- National Parks Overview
SELECT COUNT(*) as parks, SUM(area_acres) as total_acres, SUM(visitors_2023) as total_visitors FROM "parks";
SELECT "name", "state", "visitors_2023" FROM "parks" ORDER BY "visitors_2023" DESC`,
        ),
        q(
          "best-trails.sql",
          `-- Trails by difficulty with park
SELECT t."name" as trail, p."name" as park, t."distance_miles" || ' mi' as distance,
  t."elevation_gain_ft" || ' ft' as elevation, t."difficulty", t."features"
FROM "trails" t
JOIN "parks" p ON t."park_id" = p."id"
ORDER BY t."difficulty", t."distance_miles" DESC`,
        ),
        q(
          "endangered.sql",
          `-- Threatened and endangered wildlife
SELECT w."species", w."category", w."conservation_status", w."population_estimate", p."name" as park
FROM "wildlife" w
JOIN "parks" p ON w."park_id" = p."id"
WHERE w."conservation_status" IN ('Threatened', 'Critically Endangered', 'Vulnerable')
ORDER BY w."population_estimate" ASC`,
        ),
        q(
          "wildlife-by-park.sql",
          `-- Wildlife diversity per park
SELECT p."name", COUNT(w."id") as species_count,
  GROUP_CONCAT(w."species", ', ') as species
FROM "parks" p
JOIN "wildlife" w ON w."park_id" = p."id"
GROUP BY p."id"
ORDER BY species_count DESC`,
        ),
      ];
    case "recipes":
      return [
        q(
          "overview.sql",
          `-- Cookbook Overview
SELECT COUNT(*) as recipes, COUNT(DISTINCT cuisine) as cuisines,
  SUM(CASE WHEN vegetarian = 1 THEN 1 ELSE 0 END) as vegetarian
FROM "recipes";
SELECT cuisine, COUNT(*) as count FROM "recipes" GROUP BY cuisine ORDER BY count DESC`,
        ),
        q(
          "quick-meals.sql",
          `-- Fastest recipes (total time under 30 minutes)
SELECT "name", "cuisine", "prep_minutes" + "cook_minutes" as total_minutes, "difficulty"
FROM "recipes"
WHERE "prep_minutes" + "cook_minutes" <= 30
ORDER BY total_minutes`,
        ),
        q(
          "shopping-list.sql",
          `-- Shopping list for Shakshuka
SELECT i."item", i."amount" || ' ' || i."unit" as quantity
FROM "ingredients" i
JOIN "recipes" r ON i."recipe_id" = r."id"
WHERE r."name" = 'Shakshuka'
ORDER BY i."item"`,
        ),
      ];
    default:
      return [];
  }
}

// --- CLI ---

export function createTrailCLI(runtime: Runtime) {
  const output: string[] = [];
  function log(msg: string) {
    output.push(msg);
  }

  async function withMigrator(fn: (migrator: Migrator) => Promise<void>): Promise<void> {
    await runtime.runAllInDir("db/migrations");
    const proxies = discoverMigrations(runtime);
    if (proxies.length === 0) {
      log("No migrations found in db/migrations/.");
      return;
    }
    const migrator = new Migrator(runtime.adapter, proxies);
    await fn(migrator);
  }

  const commands: Record<string, (args: string[], opts: Record<string, string>) => Promise<void>> =
    {
      new: async (args) => {
        const name = args[0];
        if (!name) {
          log("Usage: new <app-name>");
          return;
        }

        log(`Creating new trails application: ${name}`);
        log("");

        // Clear existing files
        for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
        runtime.clearMigrations();

        // Generate scaffold
        const files = generateAppScaffold(name);
        for (const f of files) {
          runtime.vfs.write(f.path, f.content);
          log(`      create  ${f.path}`);
        }

        log("");
        log(`  Done! Your app "${name}" is ready.`);
        log("  Run 'generate model User name:string email:string' to add a model.");
      },

      generate: async (args, _opts) => {
        const type = args[0];
        const name = args[1];
        const columnArgs = args.slice(2);

        if (!type || !name) {
          log("Usage: generate <type> <name> [columns...]");
          log("Types: migration, model");
          return;
        }

        if (type === "migration") {
          const columns = parseColumns(columnArgs);
          const { filename, content } = generateMigrationFile(name, columns);
          runtime.vfs.write(filename, content);
          log(`      create  ${filename}`);
        } else if (type === "model") {
          const columns = parseColumns(columnArgs);

          // Generate model file
          const model = generateModelFile(name, columns);
          runtime.vfs.write(model.filename, model.content);
          log(`      create  ${model.filename}`);

          // Generate migration for create_<table>
          const tableName = tableize(classify(name));
          const migration = generateMigrationFile(`create_${tableName}`, columns);
          runtime.vfs.write(migration.filename, migration.content);
          log(`      create  ${migration.filename}`);
        } else {
          log(`Unknown generator: ${type}. Available: migration, model`);
        }
      },

      g: async (args, opts) => {
        await commands["generate"](args, opts);
      },

      scaffold: async (args) => {
        const name = args[0];
        if (!name) {
          log("Usage: scaffold <name> [columns...]");
          return;
        }
        const columnArgs = args.slice(1);
        const columns = parseColumns(columnArgs);
        const className = classify(name);
        const resourceName = tableize(className);
        const _singular = underscore(className);

        // Model + migration
        const model = generateModelFile(name, columns);
        runtime.vfs.write(model.filename, model.content);
        log(`      create  ${model.filename}`);

        const tableName = tableize(className);
        const migration = generateMigrationFile(`create_${tableName}`, columns);
        runtime.vfs.write(migration.filename, migration.content);
        log(`      create  ${migration.filename}`);

        // Controller — uses ActiveRecord model for queries
        const controllerFile = `app/controllers/${dasherize(resourceName)}-controller.ts`;
        const singular = underscore(className);
        const colAssignments = columns
          .map((c) => `      "${c.name}": this.params.get("${c.name}")`)
          .join(",\n");
        runtime.vfs.write(
          controllerFile,
          `class ${className}Controller extends ActionController.Base {
  async index() {
    const ${resourceName} = await adapter.execute('SELECT * FROM "${resourceName}" ORDER BY "id" DESC');
    this.render({ json: ${resourceName} });
  }

  async show() {
    const id = this.params.get("id");
    const rows = await adapter.execute('SELECT * FROM "${resourceName}" WHERE "id" = ?', [id]);
    if (rows.length === 0) {
      this.render({ json: { error: "${className} not found" }, status: 404 });
    } else {
      this.render({ json: rows[0] });
    }
  }

  async create() {
    const attrs = {
${colAssignments}
    };
    const cols = Object.keys(attrs).map(k => \`"\${k}"\`).join(", ");
    const vals = Object.values(attrs);
    const placeholders = vals.map(() => "?").join(", ");
    const id = await adapter.executeMutation(
      \`INSERT INTO "${resourceName}" (\${cols}, "created_at", "updated_at") VALUES (\${placeholders}, datetime("now"), datetime("now"))\`,
      vals
    );
    const ${singular} = await adapter.execute('SELECT * FROM "${resourceName}" WHERE "id" = ?', [id]);
    this.render({ json: ${singular}[0] ?? { id }, status: "created" });
  }

  async destroy() {
    const id = this.params.get("id");
    await adapter.executeMutation('DELETE FROM "${resourceName}" WHERE "id" = ?', [id]);
    this.render({ json: { deleted: true } });
  }
}

app.registerController("${resourceName}", ${className}Controller);
`,
        );
        log(`      create  ${controllerFile}`);

        // Routes
        const routesFile = runtime.vfs.read("config/routes.ts");
        if (routesFile) {
          const updated = routesFile.content.replace(
            "// routes",
            `app.drawRoutes((r) => {
  r.get("/${resourceName}", { to: "${resourceName}#index" });
  r.get("/${resourceName}/:id", { to: "${resourceName}#show" });
  r.post("/${resourceName}", { to: "${resourceName}#create" });
  r.delete("/${resourceName}/:id", { to: "${resourceName}#destroy" });
});
// routes`,
          );
          runtime.vfs.write("config/routes.ts", updated);
          log(`      insert  config/routes.ts`);
        }

        log("");
        log(`  Scaffold for ${className} created.`);
        log(`  Run: db:migrate`);
        log(`  Then: server`);
        log(`  Then: await request("GET", "/${resourceName}")`);
        log(`        await request("GET", "/${resourceName}/1")`);
        log(`        await request("POST", "/${resourceName}")`);
      },

      "db:migrate": async (_args, opts) => {
        await withMigrator(async (migrator) => {
          await migrator.migrate(opts.version ?? null);
          for (const line of migrator.output) log(line);
          const pending = await migrator.pendingMigrations();
          log(
            pending.length === 0
              ? "All migrations are up to date."
              : `${pending.length} migration(s) pending.`,
          );
        });
      },

      "db:rollback": async (_args, opts) => {
        const step = parseInt(opts.step ?? "1", 10);
        await withMigrator(async (migrator) => {
          await migrator.rollback(step);
          for (const line of migrator.output) log(line);
        });
      },

      "db:migrate:status": async () => {
        await withMigrator(async (migrator) => {
          const statuses = await migrator.migrationsStatus();
          log("");
          log(" Status   Migration ID    Migration Name");
          log("--------------------------------------------------");
          for (const s of statuses) {
            const statusStr = s.status === "up" ? "  up  " : " down ";
            log(`${statusStr}   ${s.version.padEnd(16)}${s.name}`);
          }
          log("");
        });
      },

      "db:migrate:redo": async (_args, opts) => {
        const step = parseInt(opts.step ?? "1", 10);
        await withMigrator(async (migrator) => {
          await migrator.rollback(step);
          for (const line of migrator.output) log(line);
          await migrator.migrate();
          for (const line of migrator.output.slice(migrator.output.length)) log(line);
        });
      },

      "db:seed": async () => {
        const seedFile = runtime.vfs.read("db/seeds.ts") ?? runtime.vfs.read("db/seeds.js");
        if (!seedFile) {
          log("No seeds file found at db/seeds.ts");
          return;
        }
        log("Running seeds...");
        await runtime.executeCode(seedFile.content);
        log("Seeds completed.");
      },

      "db:prepare": async () => {
        // Like Rails db:prepare — migrate pending, seed if fresh
        let migrated = 0;
        await withMigrator(async (migrator) => {
          const pending = await migrator.pendingMigrations();
          if (pending.length === 0) {
            log("Database is up to date.");
            return;
          }
          await migrator.migrate();
          for (const line of migrator.output) log(line);
          migrated = pending.length;
          log(`${migrated} migration(s) applied.`);
        });

        // Seed if migrations were just applied and tables are empty
        if (migrated > 0) {
          const seedFile = runtime.vfs.read("db/seeds.ts") ?? runtime.vfs.read("db/seeds.js");
          if (seedFile) {
            try {
              log("Running seeds...");
              await runtime.executeCode(seedFile.content);
              log("Seeds completed.");
            } catch (e: any) {
              log(`Seed error: ${e.message}`);
            }
          }
        }
      },

      "db:setup": async (_args, opts) => {
        await commands["db:migrate"]([], opts);
        await commands["db:seed"]([], opts);
      },

      "db:reset": async (_args, opts) => {
        await commands["db:drop"]([], opts);
        await commands["db:migrate"]([], opts);
        await commands["db:seed"]([], opts);
      },

      "db:drop": async () => {
        const tables = runtime.getTables();
        for (const table of tables) runtime.adapter.execRaw(`DROP TABLE IF EXISTS "${table}"`);
        runtime.adapter.execRaw('DROP TABLE IF EXISTS "schema_migrations"');
        log(`Dropped ${tables.length} table(s).`);
      },

      "db:schema:dump": async () => {
        const schema = runtime.dbSchema();
        runtime.vfs.write("db/schema.sql", schema);
        log("Schema dumped to db/schema.sql");
        log(schema);
      },

      sql: async (args) => {
        // Execute a .sql file from the VFS, or inline SQL
        const fileOrSql = args.join(" ");
        if (!fileOrSql) {
          log("Usage: sql <file.sql> or sql <SELECT ...>");
          return;
        }

        // Check if it's a file path
        const file = runtime.vfs.read(fileOrSql) ?? runtime.vfs.read(fileOrSql + ".sql");
        const sqlText = file ? file.content : fileOrSql;

        // Split on semicolons and execute each statement
        const statements = sqlText
          .split(/;\s*\n/)
          .map((s: string) => s.trim())
          .filter((s: string) => s && !s.startsWith("--"));

        for (const stmt of statements) {
          try {
            const results = runtime.adapter.execRaw(stmt);
            if (results.length > 0) {
              for (const result of results) {
                // Format as table
                const widths = result.columns.map((c, i) => {
                  const maxVal = Math.max(
                    ...result.values.map((r) => String(r[i] ?? "NULL").length),
                    c.length,
                  );
                  return Math.min(maxVal, 30);
                });
                log(result.columns.map((c, i) => c.padEnd(widths[i])).join(" | "));
                log(widths.map((w) => "-".repeat(w)).join("-+-"));
                for (const row of result.values) {
                  log(
                    row
                      .map((v, i) =>
                        String(v ?? "NULL")
                          .padEnd(widths[i])
                          .slice(0, widths[i]),
                      )
                      .join(" | "),
                  );
                }
                log(`(${result.values.length} row${result.values.length !== 1 ? "s" : ""})`);
              }
            } else {
              log(`OK: ${stmt.slice(0, 60)}${stmt.length > 60 ? "..." : ""}`);
            }
          } catch (e: any) {
            log(`ERROR: ${e.message}`);
            log(`  ${stmt.slice(0, 80)}`);
          }
        }
      },

      run: async (args) => {
        // Execute a file from the VFS (.ts or .sql)
        const filePath = args[0];
        if (!filePath) {
          log("Usage: run <file>");
          return;
        }

        const file = runtime.vfs.read(filePath);
        if (!file) {
          log(`File not found: ${filePath}`);
          return;
        }

        if (filePath.endsWith(".sql")) {
          // Delegate to sql command
          await commands["sql"]([filePath], {});
        } else {
          // Execute as TypeScript/JavaScript
          log(`Running ${filePath}...`);
          try {
            const result = await runtime.executeCode(file.content);
            if (result !== undefined) {
              log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
            }
            log("Done.");
          } catch (e: any) {
            log(`Error: ${e.message}`);
          }
        }
      },

      server: async (_args) => {
        // Load routes and controllers from VFS, start serving through app server
        const routesFile = runtime.vfs.read("config/routes.ts");
        if (!routesFile) {
          log("No config/routes.ts found. Run 'new <name>' first.");
          return;
        }

        // Run routes file to register routes
        log("Loading routes...");
        try {
          await runtime.executeCode(routesFile.content);
        } catch (e: any) {
          log(`  Error loading routes: ${e.message}`);
        }

        // Load all model files first
        const modelFiles = runtime.vfs
          .list()
          .filter((f) => f.path.startsWith("app/models/") && f.path.endsWith(".ts"))
          .sort((a, b) => a.path.localeCompare(b.path));

        for (const file of modelFiles) {
          log(`  Loading ${file.path}...`);
          try {
            await runtime.executeCode(file.content);
          } catch (e: any) {
            log(`  Error: ${e.message}`);
          }
        }

        // Then load all controller files
        const controllerFiles = runtime.vfs
          .list()
          .filter((f) => f.path.startsWith("app/controllers/") && f.path.endsWith(".ts"))
          .sort((a, b) => a.path.localeCompare(b.path));

        for (const file of controllerFiles) {
          log(`  Loading ${file.path}...`);
          try {
            await runtime.executeCode(file.content);
          } catch (e: any) {
            log(`  Error: ${e.message}`);
          }
        }

        log("");
        log("App server ready. Use request() to make requests:");
        log('  await request("GET", "/")');
        log('  await request("GET", "/posts")');
        log('  await request("POST", "/posts", { body: "title=Hello" })');
      },

      routes: async () => {
        // Show all registered routes
        const routes = runtime.app.routes;
        const allRoutes = (routes as any).routes ?? [];
        if (allRoutes.length === 0) {
          log("No routes. Run 'server' to load routes from config/routes.ts.");
          return;
        }
        log("");
        log("  Method   Path                           Controller#Action");
        log("  " + "-".repeat(60));
        for (const route of allRoutes) {
          const method = (route.method ?? "GET").padEnd(8);
          const path = (route.path ?? "/").padEnd(30);
          const endpoint = `${route.controller}#${route.action}`;
          log(`  ${method} ${path} ${endpoint}`);
        }
        log("");
      },

      sample: async (args) => {
        const name = args[0];
        if (!name) {
          log("Available sample databases:");
          for (const s of sampleDatabases) {
            log(`  ${s.name.padEnd(20)} ${s.description}`);
          }
          log("");
          log("Usage: sample <name>");
          return;
        }

        const sample = sampleDatabases.find((s) => s.name === name);
        if (!sample) {
          log(`Unknown sample: ${name}`);
          log(`Available: ${sampleDatabases.map((s) => s.name).join(", ")}`);
          return;
        }

        log(`Loading sample database: ${sample.name}...`);

        // Execute the SQL
        const statements = sample.sql
          .split(/;\s*\n/)
          .map((s: string) => s.trim())
          .filter((s: string) => s && !s.startsWith("--"));

        let tables = 0;
        let rows = 0;
        for (const stmt of statements) {
          try {
            runtime.adapter.execRaw(stmt);
            if (stmt.toUpperCase().startsWith("CREATE TABLE")) tables++;
            if (stmt.toUpperCase().startsWith("INSERT")) {
              rows +=
                (runtime.adapter.execRaw("SELECT changes()")[0]?.values[0]?.[0] as number) ?? 0;
            }
          } catch (e: any) {
            log(`  Error: ${e.message}`);
          }
        }

        // Write some fun query files
        const queries = getSampleQueries(sample.name);
        for (const q of queries) {
          runtime.vfs.write(q.path, q.content);
          log(`      create  ${q.path}`);
        }

        log(`  Created ${tables} tables, inserted ${rows} rows.`);
        log(`  Try: sql queries/${sample.name}/overview.sql`);
      },

      load: async (args, opts) => {
        // Load a project from the backend API
        const id = args[0];
        if (!id) {
          log("Usage: load <project-id>");
          return;
        }

        const apiBase =
          opts.api ??
          (typeof import.meta !== "undefined"
            ? (import.meta as any).env?.VITE_FRONTIERS_API
            : null);
        if (!apiBase) {
          log("No API configured. Set VITE_FRONTIERS_API.");
          return;
        }

        log(`Fetching project ${id}...`);
        try {
          const res = await fetch(`${apiBase}/api/projects/${id}`);
          if (!res.ok) {
            log(`Error: ${res.status} ${res.statusText}`);
            return;
          }
          const name = res.headers.get("x-project-name") ?? "untitled";
          const data = new Uint8Array(await res.arrayBuffer());
          runtime.loadDB(data);
          log(`Loaded "${name}" (${(data.length / 1024).toFixed(1)}KB)`);
        } catch (e: any) {
          log(`Error: ${e.message}`);
        }
      },
    };

  return {
    async exec(input: string): Promise<CliResult> {
      output.length = 0;
      const { command, args, opts } = parseInput(input);

      const handler = commands[command];
      if (!handler) {
        return {
          success: false,
          output: [
            `Unknown command: ${command}`,
            "",
            "Available commands:",
            "  new <name>                             Create a new app",
            "  generate migration <name> [cols...]    Generate a migration",
            "  generate model <name> [cols...]        Generate a model + migration",
            "  scaffold <name> [cols...]              Model + migration + controller + views",
            "  g <type> <name> [cols...]              Alias for generate",
            "  server                                  Load routes + controllers",
            "  routes                                  Show registered routes",
            "  routes                                  Show registered routes",
            "  sample [name]                           Load a sample database",
            "  sql <file.sql | SELECT ...>            Execute SQL",
            "  run <file>                             Run a .ts or .sql file",
            "  load <project-id>                      Load project from backend API",
            ...Object.keys(commands)
              .filter((c) => c.startsWith("db:"))
              .map((c) => `  ${c}`),
          ],
          exitCode: 1,
        };
      }

      try {
        await handler(args, opts);
        return { success: true, output: [...output], exitCode: 0 };
      } catch (e: any) {
        output.push(`Error: ${e.message}`);
        return { success: false, output: [...output], exitCode: 1 };
      }
    },

    commands: Object.keys(commands),
  };
}
