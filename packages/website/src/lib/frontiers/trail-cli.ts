import type { VirtualFS } from "./virtual-fs.js";
import type { SqlJsAdapter } from "./sql-js-adapter.js";
import { VfsGeneratorBase, type VfsGeneratorOptions } from "./vfs-generator.js";
import { ModelGenerator } from "@blazetrails/railties/generators";
import type { MigrationProxy, MigrationLike } from "@blazetrails/activerecord";
import { Migrator } from "@blazetrails/activerecord";
import { underscore, camelize, tableize, dasherize } from "@blazetrails/activesupport";

export interface CliResult {
  success: boolean;
  output: string[];
  exitCode: number;
}

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
    } else {
      args.push(parts[i]);
    }
  }
  return { command, args, opts };
}

const MIGRATION_FILE_PATTERN = /^(\d+)[-_](.+)\.ts$/;

function discoverMigrations(
  vfs: VirtualFS,
  executeCode: (code: string) => Promise<unknown>,
  getMigrations: () => MigrationProxy[],
): MigrationProxy[] {
  return vfs
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
              const content = vfs.read(file.path)?.content;
              if (!content) throw new Error(`File not found: ${file.path}`);
              await executeCode(content);
              const reg = getMigrations().find((m) => m.version === match![1]);
              if (reg) await reg.migration().up(adapter);
            },
            async down(adapter) {
              const content = vfs.read(file.path)?.content;
              if (!content) throw new Error(`File not found: ${file.path}`);
              await executeCode(content);
              const reg = getMigrations().find((m) => m.version === match![1]);
              if (reg) await reg.migration().down(adapter);
            },
          }),
        },
      ];
    });
}

class VfsModelGenerator extends VfsGeneratorBase {
  private delegate: ModelGenerator;

  constructor(options: VfsGeneratorOptions) {
    super(options);
    this.delegate = new ModelGenerator({ cwd: "/", output: options.output });
  }

  run(name: string, args: string[]): string[] {
    // Intercept: use delegate's logic but write to VFS via our overridden createFile
    // We can't directly call delegate.run() because it uses node:fs.
    // Instead, replicate the generator output pattern writing to VFS.
    const singularName = underscore(name).replace(/s$/, "");
    const className = camelize(singularName.replace(/-/g, "_"));
    const fileName = dasherize(singularName);
    const columns = args
      .filter((a) => !a.startsWith("-") && a.includes(":"))
      .map((a) => {
        const [colName, rawType] = a.split(":");
        return { name: colName, type: rawType.replace(/\{[^}]*\}/, "") };
      });

    const bodyLines: string[] = [];
    for (const col of columns) {
      if (col.type === "references" || col.type === "belongs_to") {
        bodyLines.push(`    this.belongsTo("${col.name}");`);
      } else {
        bodyLines.push(`    this.attribute("${col.name}", "${col.type}");`);
      }
    }
    bodyLines.push('    this.attribute("created_at", "datetime");');
    bodyLines.push('    this.attribute("updated_at", "datetime");');

    const staticBlock = `\n  static {\n${bodyLines.join("\n")}\n  }\n`;
    const tableName = tableize(className);

    this.createFile(
      `app/models/${fileName}.ts`,
      `class ${className} extends Base {\n  static tableName = "${tableName}";${staticBlock}}\n`,
    );

    // Migration
    const timestamp = Date.now().toString();
    const migClassName = `Create${camelize(tableName)}`;
    const colLines = columns
      .map((c) => {
        if (c.type === "references" || c.type === "belongs_to") {
          return `      t.references("${c.name}", { foreignKey: true });`;
        }
        return `      t.${c.type}("${c.name}");`;
      })
      .join("\n");

    this.createFile(
      `db/migrations/${timestamp}-create-${dasherize(tableName)}.ts`,
      `class ${migClassName} extends Migration {
  version = "${timestamp}";

  async up() {
    await this.createTable("${tableName}", (t) => {
${colLines}
      t.timestamps();
    });
  }

  async down() {
    await this.dropTable("${tableName}");
  }
}

runtime.registerMigration({
  version: "${timestamp}",
  name: "${migClassName}",
  migration: () => {
    const m = new ${migClassName}();
    return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
  },
});
`,
    );

    return this.getCreatedFiles();
  }
}

function generateAppScaffold(name: string): Array<{ path: string; content: string }> {
  return [
    {
      path: "app/main.ts",
      content: `// ${name} — main entry point\nreturn "${name} is ready. Run: generate model User name:string email:string";\n`,
    },
    {
      path: "config/routes.ts",
      content: `// Define your application routes here.\n// routes\n`,
    },
    {
      path: "app/controllers/application-controller.ts",
      content: `class ApplicationController extends ActionController.Base {\n}\n`,
    },
    {
      path: "db/seeds.ts",
      content: `// Seed your database here.\n`,
    },
  ];
}

export interface TrailCliDeps {
  vfs: VirtualFS;
  adapter: SqlJsAdapter;
  executeCode: (code: string) => Promise<unknown>;
  getMigrations: () => MigrationProxy[];
  registerMigration: (proxy: MigrationProxy) => void;
  clearMigrations: () => void;
  getTables: () => string[];
  runAllInDir: (dir: string) => Promise<void>;
}

export function createTrailCLI(deps: TrailCliDeps) {
  const { vfs, adapter } = deps;
  const output: string[] = [];
  function log(msg: string) {
    output.push(msg);
  }

  async function withMigrator(fn: (migrator: Migrator) => Promise<void>): Promise<void> {
    await deps.runAllInDir("db/migrations");
    const proxies = discoverMigrations(vfs, deps.executeCode, deps.getMigrations);
    if (proxies.length === 0) {
      log("No migrations found in db/migrations/.");
      return;
    }
    const migrator = new Migrator(adapter, proxies);
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

        for (const f of vfs.list()) vfs.delete(f.path);
        deps.clearMigrations();

        const files = generateAppScaffold(name);
        for (const f of files) {
          vfs.write(f.path, f.content);
          log(`      create  ${f.path}`);
        }

        log("");
        log(`  Done! Your app "${name}" is ready.`);
        log("  Run 'generate model User name:string email:string' to add a model.");
      },

      generate: async (args) => {
        const type = args[0];
        const name = args[1];
        const columnArgs = args.slice(2);

        if (!type || !name) {
          log("Usage: generate <type> <name> [columns...]");
          log("Types: model");
          return;
        }

        if (type === "model") {
          const gen = new VfsModelGenerator({ vfs, output: log });
          gen.run(name, columnArgs);
        } else {
          log(`Unknown generator: ${type}. Available: model`);
        }
      },

      g: async (args) => {
        await commands["generate"](args, {});
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

      "db:seed": async () => {
        const seedFile = vfs.read("db/seeds.ts");
        if (!seedFile) {
          log("No seeds file found at db/seeds.ts");
          return;
        }
        log("Running seeds...");
        await deps.executeCode(seedFile.content);
        log("Seeds completed.");
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
        const tables = deps.getTables();
        for (const table of tables) adapter.execRaw(`DROP TABLE IF EXISTS "${table}"`);
        adapter.execRaw('DROP TABLE IF EXISTS "schema_migrations"');
        log(`Dropped ${tables.length} table(s).`);
      },

      sql: async (args) => {
        const fileOrSql = args.join(" ");
        if (!fileOrSql) {
          log("Usage: sql <file.sql | SELECT ...>");
          return;
        }

        const file = vfs.read(fileOrSql) ?? vfs.read(fileOrSql + ".sql");
        const sqlText = file ? file.content : fileOrSql;

        const statements = sqlText
          .split(/;\s*\n/)
          .map((s: string) => s.trim())
          .filter((s: string) => s && !s.startsWith("--"));

        for (const stmt of statements) {
          try {
            const results = adapter.execRaw(stmt);
            if (results.length > 0) {
              for (const result of results) {
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
          }
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
            "  new <name>                           Create a new app",
            "  generate model <name> [cols...]      Generate a model + migration",
            "  g <type> <name> [cols...]            Alias for generate",
            "  sql <file.sql | SELECT ...>          Execute SQL",
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
