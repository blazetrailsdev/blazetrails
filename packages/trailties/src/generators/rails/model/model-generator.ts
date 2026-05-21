import { camelize } from "@blazetrails/activesupport";
import { NamedBase, type NamedBaseOptions } from "../../named-base.js";
import { normalizeModelName, type ModelHelpersOptions } from "../../model-helpers.js";

// Mirrors railties/lib/rails/generators/rails/model/model_generator.rb.
// Rails' `hook_for :orm, required: true` is replaced with a direct emit;
// `Base` is @blazetrails/activerecord's public model base.
export interface ModelGeneratorOptions extends NamedBaseOptions, ModelHelpersOptions {}

const TS_TYPES: Record<string, string> = {
  integer: "number",
  float: "number",
  decimal: "number",
  boolean: "boolean",
  date: "Date",
  datetime: "Date",
  timestamp: "Date",
  time: "Date",
  references: "number",
  belongs_to: "number",
  binary: "Uint8Array",
  digest: "string",
};

export class ModelGenerator extends NamedBase {
  constructor(options: ModelGeneratorOptions) {
    const normalized = normalizeModelName(options.name, options, options.output);
    super({ ...options, name: normalized });
  }

  run(): string[] {
    const filename = `app/models/${this.filePath()}${this.ext()}`;
    const className = camelize(this.fileName);
    const attrs = this.attributes
      .filter((a) => !a.virtual())
      .map((a) => `  ${a.columnName()}!: ${TS_TYPES[a.type] ?? "string"};`)
      .join("\n");
    this.createFile(
      filename,
      `import { Base } from "@blazetrails/activerecord";

export class ${className} extends Base {
${attrs}
}
`,
    );
    return this.getCreatedFiles();
  }
}
