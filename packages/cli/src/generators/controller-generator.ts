import { GeneratorBase, GeneratorOptions, classify, dasherize } from "./base.js";

export class ControllerGenerator extends GeneratorBase {
  constructor(options: GeneratorOptions) {
    super(options);
  }

  run(name: string, actions: string[]): string[] {
    const className = classify(name) + (name.endsWith("Controller") ? "" : "Controller");
    const fileName = dasherize(name.replace(/Controller$/i, "")) + "-controller";

    const ext = this.ext();
    const ts = this.isTypeScript();
    const esm = this.isESM();
    const returnType = ts ? ": Promise<void>" : "";

    // Controller file
    const actionMethods = actions
      .map((a) => `  async ${a}()${returnType} {\n    // TODO: implement\n  }`)
      .join("\n\n");

    const importLine = esm
      ? `import { ActionController } from "@rails-ts/actionpack";`
      : `const { ActionController } = require("@rails-ts/actionpack");`;
    const exportPrefix = esm ? "export class" : "class";
    const exportSuffix = esm ? "" : `\nmodule.exports = { ${className} };\n`;

    this.createFile(
      `src/app/controllers/${fileName}${ext}`,
      `${importLine}

${exportPrefix} ${className} extends ActionController.Base {
${actionMethods}
}
${exportSuffix}`,
    );

    // Test file
    const actionTests = actions
      .map((a) => `  it("${a}", () => {\n    // TODO: test ${a} action\n  });`)
      .join("\n\n");

    if (esm) {
      this.createFile(
        `test/controllers/${fileName}.test${ext}`,
        `import { describe, it, expect } from "vitest";
import { ${className} } from "../../src/app/controllers/${fileName}.js";

describe("${className}", () => {
${actionTests}
});
`,
      );
    } else {
      this.createFile(
        `test/controllers/${fileName}.test${ext}`,
        `const { describe, it, expect } = require("vitest");
const { ${className} } = require("../../src/app/controllers/${fileName}.js");

describe("${className}", () => {
${actionTests}
});
`,
      );
    }

    // Append routes
    const routesFile = this.fileExists("src/config/routes.ts")
      ? "src/config/routes.ts"
      : this.fileExists("src/config/routes.js")
        ? "src/config/routes.js"
        : null;
    if (actions.length > 0 && routesFile) {
      const routeLines = actions
        .map((a) => {
          const resource = dasherize(name.replace(/Controller$/i, ""));
          return `  router.get("/${resource}/${a}", "${resource}#${a}");`;
        })
        .join("\n");
      this.insertIntoFile(routesFile, "// routes", routeLines + "\n");
    }

    return this.getCreatedFiles();
  }
}
