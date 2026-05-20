import { cwd as getCwd } from "@blazetrails/activesupport/process-adapter";
import { getPath } from "@blazetrails/activesupport";
import { Command } from "commander";
import { AppGenerator } from "../generators/app-generator.js";

// Mirror of `bin/rails app:template`. Rails source:
// railties/lib/rails/tasks/framework.rake.
export function appCommand(): Command {
  const cmd = new Command("app");
  cmd.description("Apply app templates and other app-level tasks");

  cmd
    .command("template")
    .description("Apply the template supplied by <location>")
    .argument("<location>", "Path to a template file (.mjs/.js; .ts requires a TS loader like tsx)")
    .action(async (location: string) => {
      const path = getPath();
      if (!path.pathToFileURL) throw new Error("app:template needs PathAdapter.pathToFileURL");
      const abs = path.isAbsolute?.(location) ? location : path.resolve(getCwd(), location);
      const mod = await import(path.pathToFileURL(abs).href);
      const tmpl: unknown = mod.default ?? mod.template ?? mod;
      if (typeof tmpl !== "function") throw new Error(`${location} does not export a function`);
      await (tmpl as (g: AppGenerator) => unknown)(
        new AppGenerator({ cwd: getCwd(), output: console.log }),
      );
    });

  return cmd;
}
