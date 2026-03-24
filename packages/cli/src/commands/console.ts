import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import * as vm from "node:vm";

export function consoleCommand(): Command {
  const cmd = new Command("console");
  cmd.alias("c");
  cmd.description("Start an interactive console with the application loaded").action(async () => {
    const repl = await import("node:repl");

    // Connect to database
    let dbAdapter: any;
    try {
      const { loadDatabaseConfig, connectAdapter } = await import("../database.js");
      const config = await loadDatabaseConfig();
      dbAdapter = await connectAdapter(config);
      const { Base } = await import("@rails-ts/activerecord");
      Base.adapter = dbAdapter;
      console.log(
        `Connected to ${config.adapter ?? "sqlite3"} (${config.database ?? "in-memory"})`,
      );
    } catch (error) {
      console.log("Could not connect to database.");
      if (error instanceof Error) {
        console.log(error.message);
      }
    }

    console.log("Loading rails-ts console...");

    // Custom eval that supports top-level await (e.g., `await User.all()`)
    const asyncEval = (code: string, context: any, _filename: string, callback: any) => {
      (async () => {
        try {
          // Try as-is first (handles expressions, assignments, etc.)
          const result = await vm.runInNewContext(
            `(async () => { return (\n${code}\n); })()`,
            context,
            { breakOnSigint: true },
          );
          callback(null, result);
        } catch {
          try {
            // Retry as statements (handles `const x = await ...`)
            const result = await vm.runInNewContext(`(async () => {\n${code}\n})()`, context, {
              breakOnSigint: true,
            });
            callback(null, result);
          } catch (err: any) {
            // Check for recoverable errors (incomplete input)
            if (isRecoverable(err)) {
              callback(new (repl as any).Recoverable(err));
            } else {
              callback(err);
            }
          }
        }
      })();
    };

    const r = repl.start({
      prompt: "rails-ts> ",
      eval: asyncEval,
    });

    // Copy globals into the REPL context
    r.context.console = console;
    r.context.process = process;
    r.context.require = require;

    r.on("exit", async () => {
      if (dbAdapter && typeof dbAdapter.close === "function") {
        await dbAdapter.close();
      }
    });

    // Make activerecord Base available
    try {
      const ar = await import("@rails-ts/activerecord");
      r.context.Base = ar.Base;
      r.context.Migration = ar.Migration;
    } catch {
      // activerecord not available
    }

    // Load models from the current project
    const modelsDir = path.join(process.cwd(), "src", "app", "models");
    let loadedCount = 0;
    if (fs.existsSync(modelsDir)) {
      const files = fs
        .readdirSync(modelsDir)
        .filter((f: string) => f.endsWith(".ts") || f.endsWith(".js"));
      for (const file of files) {
        try {
          const mod = await import(pathToFileURL(path.join(modelsDir, file)).href);
          for (const [name, value] of Object.entries(mod)) {
            if (typeof value === "function") {
              (r.context as any)[name] = value;
            }
          }
          loadedCount++;
        } catch {
          // Skip files that fail to import
        }
      }
      if (loadedCount > 0) {
        console.log(`Loaded ${loadedCount} model(s) from src/app/models/`);
      }
    }

    console.log("Supports top-level await (e.g., await User.all())");
    console.log('Type ".exit" or Ctrl+D to quit.');
    console.log("");
  });

  return cmd;
}

function isRecoverable(err: Error): boolean {
  return /^(Unexpected end of input|Unexpected token)/.test(err.message);
}
