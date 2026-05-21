import { camelize } from "@blazetrails/activesupport";
import { NamedBase, type NamedBaseOptions } from "../../named-base.js";
import { normalizeModelName, type ModelHelpersOptions } from "../../model-helpers.js";
import { tsType, type ColumnType } from "../../base.js";

// Mirrors railties/lib/rails/generators/rails/model/model_generator.rb.
// Rails' `hook_for :orm, required: true` is replaced with a direct ORM-
// agnostic emit; a future PR can dispatch to per-ORM templates.
export interface ModelGeneratorOptions extends NamedBaseOptions, ModelHelpersOptions {}

export class ModelGenerator extends NamedBase {
  constructor(options: ModelGeneratorOptions) {
    const normalized = normalizeModelName(options.name, options, options.output);
    super({ ...options, name: normalized });
  }

  run(): string[] {
    const ext = this.ext();
    const filename = `app/models/${this.filePath()}${ext}`;
    const className = camelize(this.fileName);
    const attrs = this.attributes
      .map((a) => `  ${a.columnName()}!: ${tsType(a.type as ColumnType)};`)
      .join("\n");
    this.createFile(
      filename,
      `import { Model } from "@blazetrails/activerecord";

export class ${className} extends Model {
${attrs}
}
`,
    );
    return this.getCreatedFiles();
  }
}
