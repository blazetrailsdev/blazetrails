import { NamedBase, type NamedBaseOptions } from "../../named-base.js";
import { classify, dasherize, migrationTimestamp } from "../../base.js";

// Mirrors railties/lib/rails/generators/rails/migration/migration_generator.rb.
// Rails' `hook_for :orm, required: true` defers all template emission to
// the ORM-provided generator. This skeleton emits a minimal ORM-agnostic
// `Migration` class extending @blazetrails/activerecord; richer
// CreateX / AddXToY inference lives in the existing top-level
// MigrationGenerator and will be folded in when the ORM hook lands.
let lastTimestamp: string | null = null;

export class MigrationGenerator extends NamedBase {
  constructor(options: NamedBaseOptions) {
    super(options);
  }

  static exitOnFailure(): boolean {
    return true;
  }

  run(): string[] {
    let timestamp = migrationTimestamp();
    if (lastTimestamp && timestamp <= lastTimestamp) {
      timestamp = (parseInt(lastTimestamp, 10) + 1).toString();
    }
    lastTimestamp = timestamp;
    const filename = `db/migrations/${timestamp}-${dasherize(this.fileName)}${this.ext()}`;
    const className = classify(this.fileName);
    this.createFile(
      filename,
      `import { Migration } from "@blazetrails/activerecord";

export class ${className} extends Migration {
  static version = "${timestamp}";

  async change(): Promise<void> {}
}
`,
    );
    return this.getCreatedFiles();
  }
}
