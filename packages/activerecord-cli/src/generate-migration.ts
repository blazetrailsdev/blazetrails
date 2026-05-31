import { mkdir, writeFile, access } from "fs/promises";
import { join } from "path";
import { camelize, underscore, pluralize } from "@blazetrails/activesupport";

export interface FieldSpec {
  name: string;
  type: string;
}

export interface GenerateMigrationOptions {
  force?: boolean;
  dryRun?: boolean;
}

export interface GenerateMigrationResult {
  path: string;
  written: boolean;
  skipped: boolean;
}

export function parseFields(tokens: string[]): FieldSpec[] {
  return tokens
    .filter((t) => t.includes(":"))
    .map((t) => {
      const [name, rawType = "string"] = t.split(":");
      const type = rawType || "string";
      return { name, type };
    });
}

/** Normalize a user-supplied name: strip namespace separators so `Admin::User` → `admin_user`. */
export function normalizeSnakeName(name: string): string {
  return underscore(name).replace(/\//g, "_");
}

/** pluralize(underscore(x)) — mirrors Rails' `tableize`. */
function tableize(name: string): string {
  return pluralize(underscore(name));
}

function isReference(type: string): boolean {
  return type === "references" || type === "belongs_to";
}

function renderBody(snakeName: string, fields: FieldSpec[]): string {
  let m: RegExpExecArray | null;

  // add_*_to_* — tableize the captured segment so "add_email_to_user" → table "users"
  m = /^add_.*_to_(.+)$/.exec(snakeName);
  if (m) {
    const tbl = tableize(m[1]);
    const cols = fields
      .map((f) =>
        isReference(f.type)
          ? `    await this.addReference("${tbl}", "${f.name}", { foreignKey: true });`
          : `    await this.addColumn("${tbl}", "${f.name}", "${f.type}");`,
      )
      .join("\n");
    return cols || `    // TODO: add columns to ${tbl}`;
  }

  // remove_*_from_* — same tableize treatment
  m = /^remove_.*_from_(.+)$/.exec(snakeName);
  if (m) {
    const tbl = tableize(m[1]);
    const cols = fields
      .map((f) =>
        isReference(f.type)
          ? `    await this.removeReference("${tbl}", "${f.name}");`
          : `    await this.removeColumn("${tbl}", "${f.name}", "${f.type}");`,
      )
      .join("\n");
    return cols || `    // TODO: remove columns from ${tbl}`;
  }

  // create_* — emit t.references(...) for reference fields (Rails template does the same)
  m = /^create_(.+)$/.exec(snakeName);
  if (m) {
    const tbl = pluralize(m[1]);
    const cols = fields
      .map((f) =>
        isReference(f.type)
          ? `      t.references("${f.name}", { foreignKey: true });`
          : `      t.${f.type}("${f.name}");`,
      )
      .join("\n");
    const inner = cols ? `\n${cols}\n      t.timestamps();\n    ` : "\n      t.timestamps();\n    ";
    return `    await this.createTable("${tbl}", (t) => {${inner}});`;
  }

  return "    // TODO: implement migration";
}

export function renderMigration(snakeName: string, fields: FieldSpec[]): string {
  const className = camelize(snakeName);
  return (
    `import { Migration } from "@blazetrails/activerecord";\n\n` +
    `export default class ${className} extends Migration {\n` +
    `  async change(): Promise<void> {\n` +
    `${renderBody(snakeName, fields)}\n` +
    `  }\n` +
    `}\n`
  );
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function generateMigration(
  root: string,
  name: string,
  fields: FieldSpec[],
  ts: number,
  options: GenerateMigrationOptions = {},
): Promise<GenerateMigrationResult> {
  const snakeName = normalizeSnakeName(name);
  const path = join(root, "db", "migrate", `${ts}_${snakeName}.ts`);
  if (!options.dryRun) {
    await mkdir(join(root, "db", "migrate"), { recursive: true });
    if (!options.force && (await exists(path))) return { path, written: false, skipped: true };
    await writeFile(path, renderMigration(snakeName, fields), "utf8");
  }
  return { path, written: !options.dryRun, skipped: false };
}
