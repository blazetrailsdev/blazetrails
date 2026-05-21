import { NamedBase, type NamedBaseOptions } from "../../named-base.js";

export interface TaskRunOptions {
  actions?: string[];
}

export class TaskGenerator extends NamedBase {
  constructor(options: NamedBaseOptions) {
    super(options);
  }

  run(options: TaskRunOptions = {}): string[] {
    const actions = options.actions ?? [];
    const ext = this.ext();
    const filename = `lib/tasks/${this.fileName}${ext}`;
    const actionLines = actions.map((a) => `  // TODO\n  ${a}() {\n  },\n`).join("\n");

    this.createFile(
      filename,
      `import { namespace } from "@blazetrails/trailties";

export default namespace("${this.fileName}", {
${actionLines}});
`,
    );
    return this.getCreatedFiles();
  }
}
