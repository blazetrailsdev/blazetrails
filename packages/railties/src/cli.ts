import { Command } from "commander";
import { VERSION } from "./version.js";
import { newCommand } from "./commands/new.js";
import { generateCommand } from "./commands/generate.js";
import { serverCommand } from "./commands/server.js";
import { dbCommand } from "./commands/db.js";
import { routesCommand } from "./commands/routes.js";
import { consoleCommand } from "./commands/console.js";
import { destroyCommand } from "./commands/destroy.js";

export { AppGenerator } from "./generators/app-generator.js";
export { ModelGenerator } from "./generators/model-generator.js";
export { MigrationGenerator } from "./generators/migration-generator.js";
export { ControllerGenerator } from "./generators/controller-generator.js";
export { ScaffoldGenerator } from "./generators/scaffold-generator.js";
export { GeneratorBase } from "./generators/base.js";
export type { GeneratorOptions } from "./generators/base.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("trails")
    .description("TypeScript framework inspired by Ruby on Rails")
    .version(VERSION, "-v, --version");

  program.addCommand(newCommand());
  program.addCommand(generateCommand());
  program.addCommand(serverCommand());
  program.addCommand(dbCommand());
  program.addCommand(routesCommand());
  program.addCommand(consoleCommand());
  program.addCommand(destroyCommand());

  return program;
}
