import { resolve, join } from "path";
import { getFsAsync } from "@blazetrails/activesupport";
import { Base, DatabaseConfigurations, DatabaseTasks } from "@blazetrails/activerecord";
import { loadDatabaseConfig } from "./db-helpers.js";

async function tryLoadModels(cwd: string): Promise<void> {
  const fsAdapter = await getFsAsync();
  const modelsPath = resolve(join(cwd, "app", "models", "index.ts"));
  if (!fsAdapter.existsSync(modelsPath)) return;
  const { pathToFileURL } = await import("node:url");
  await import(pathToFileURL(modelsPath).href);
}

export async function arRunner(cwd: string, args: string[]): Promise<number> {
  const envIdx = args.indexOf("--env");
  if (envIdx >= 0 && args[envIdx + 1] && !args[envIdx + 1].startsWith("-")) {
    process.env["TRAILS_ENV"] = args[envIdx + 1];
  }

  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--env") {
      i++;
      continue;
    }
    if (!args[i]!.startsWith("-")) positional.push(args[i]!);
  }
  const scriptPath = positional[0];
  if (!scriptPath) {
    console.error("ar: runner requires a script path.");
    return 1;
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

  await tryLoadModels(cwd);

  const scriptArgv = positional.slice(1);
  (globalThis as unknown as Record<string, unknown>)["__ARGV__"] = scriptArgv;

  const abs = resolve(join(cwd, scriptPath));
  const { pathToFileURL } = await import("node:url");
  try {
    await import(pathToFileURL(abs).href);
  } catch (err) {
    console.error(`ar: runner script failed — ${String(err)}`);
    return 1;
  } finally {
    try {
      Base.removeConnection();
    } catch {
      /* pool may already be gone */
    }
    delete (globalThis as unknown as Record<string, unknown>)["__ARGV__"];
  }

  return 0;
}
