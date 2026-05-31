import { resolve, join } from "path";
import { getFsAsync } from "@blazetrails/activesupport";
import { Base, DatabaseConfigurations, DatabaseTasks } from "@blazetrails/activerecord";
import { loadDatabaseConfig } from "./db-helpers.js";

async function tryLoadModels(cwd: string): Promise<Record<string, unknown>> {
  const fsAdapter = await getFsAsync();
  const modelsPath = resolve(join(cwd, "app", "models", "index.ts"));
  if (!fsAdapter.existsSync(modelsPath)) return {};
  const { pathToFileURL } = await import("node:url");
  const mod = await import(pathToFileURL(modelsPath).href);
  return mod as Record<string, unknown>;
}

export interface StartOptions {
  /** Override of repl.start — injected by tests to avoid opening a real REPL. */
  startRepl?: (opts: { prompt: string; useGlobal: boolean }) => {
    on(event: string, cb: () => void): void;
  };
}

export async function arConsole(
  cwd: string,
  args: string[],
  opts: StartOptions = {},
): Promise<number> {
  const envIdx = args.indexOf("--env");
  if (envIdx >= 0 && args[envIdx + 1] && !args[envIdx + 1].startsWith("-")) {
    process.env["TRAILS_ENV"] = args[envIdx + 1];
  }

  try {
    await loadDatabaseConfig(cwd);
  } catch (err) {
    console.error(`ar: failed to load config/database.ts — ${String(err)}`);
    return 1;
  }

  const env = DatabaseConfigurations.currentEnv();
  const configs = DatabaseTasks.configsFor(env);
  if (configs.length > 0) {
    try {
      await Base.establishConnection({ ...configs[0]! });
    } catch (err) {
      console.error(`ar: failed to establish connection — ${String(err)}`);
      return 1;
    }
  }

  const models = await tryLoadModels(cwd);

  type ReplStart = (o: { prompt: string; useGlobal: boolean }) => {
    on(e: string, cb: () => void): void;
  };
  const replMod = opts.startRepl ? null : await import("repl");
  const startFn: ReplStart = (opts.startRepl ?? replMod!.start.bind(replMod!)) as ReplStart;
  const replContext = startFn({ prompt: "trails> ", useGlobal: false });

  const ctx = (replContext as unknown as { context: Record<string, unknown> }).context;
  if (ctx) Object.assign(ctx, { Base, ...models });

  return new Promise<number>((res) => {
    replContext.on("exit", () => {
      try {
        Base.removeConnection();
      } catch {
        /* pool may already be gone */
      }
      res(0);
    });
  });
}
