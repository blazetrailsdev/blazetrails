import {
  GeneratorBase,
  type GeneratorOptions,
  classify,
  dasherize,
  parseColumns,
  tableize,
  underscore,
} from "../../base.js";
import { tsBody, tsMethod, type Method } from "../../../template-builder/index.js";
import { emitControllerClass } from "../controller/controller-paths.js";

export interface ScaffoldControllerRunOptions {
  api?: boolean;
  skipRoutes?: boolean;
  test?: boolean;
  helper?: boolean;
}

// Mirrors railties/lib/rails/generators/rails/scaffold_controller/scaffold_controller_generator.rb.
export class ScaffoldControllerGenerator extends GeneratorBase {
  constructor(options: GeneratorOptions) {
    super(options);
  }

  run(
    name: string,
    attributes: string[] = [],
    options: ScaffoldControllerRunOptions = {},
  ): string[] {
    const { api = false, skipRoutes = false, test = true, helper = true } = options;
    const className = classify(name.replace(/_?controller$/i, ""));
    const resourceName = tableize(className);
    const singular = underscore(className);
    const controllerClassName = classify(resourceName) + "Controller";
    const controllerFileName = dasherize(resourceName) + "-controller";
    const ext = this.ext();
    const ts = this.isTypeScript();
    const attrNames = parseColumns(attributes).map((c) => c.name);

    this.createFile(
      `src/app/controllers/${controllerFileName}${ext}`,
      emitControllerClass({
        className: controllerClassName,
        methods: api
          ? apiCrudMethods(className, singular, resourceName, attrNames, ts)
          : crudMethods(className, singular, resourceName, attrNames, ts),
      }),
    );

    if (test) {
      const skip = (a: string) =>
        api && (a === "new" || a === "edit") ? "" : `  it("${a}", () => {});\n`;
      this.createFile(
        `test/controllers/${controllerFileName}.test${ext}`,
        `import { describe, it } from "vitest";
import { ${controllerClassName} } from "../../src/app/controllers/${controllerFileName}.js";

describe("${controllerClassName}", () => {
  it("references controller", () => { void ${controllerClassName}; });
${skip("index")}${skip("show")}${skip("new")}${skip("create")}${skip("edit")}${skip("update")}${skip("destroy")}});
`,
      );
    }

    if (helper && !api) {
      this.createFile(
        `src/app/helpers/${dasherize(resourceName)}-helper${ext}`,
        `export const ${classify(resourceName)}Helper = {\n};\n`,
      );
    }

    if (!skipRoutes) {
      const routesFile = this.fileExists("src/config/routes.ts")
        ? "src/config/routes.ts"
        : this.fileExists("src/config/routes.js")
          ? "src/config/routes.js"
          : null;
      if (routesFile) {
        this.insertIntoFile(routesFile, "// routes", `  router.resources("${resourceName}");\n`);
      }
    }
    return this.getCreatedFiles();
  }
}

function mk(name: string, body: string, ts: boolean): Method {
  return tsMethod({
    name,
    params: [],
    async: true,
    returnType: ts ? "Promise<void>" : undefined,
    body: tsBody`${body}`,
  });
}

function paramsMethod(singular: string, attrs: string[], ts: boolean): Method {
  const list =
    attrs.length === 0
      ? `return this.params.fetch("${singular}", {});`
      : `return this.params.expect("${singular}", [${attrs.map((a) => `"${a}"`).join(", ")}]);`;
  return tsMethod({
    name: `${singular}Params`,
    params: [],
    returnType: ts ? "Record<string, unknown>" : undefined,
    body: tsBody`${list}`,
  });
}

function crudMethods(
  model: string,
  singular: string,
  plural: string,
  attrs: string[],
  ts: boolean,
): Method[] {
  const anyArr = ts ? ": any[]" : "";
  const params = `this.${singular}Params()`;
  return [
    mk(
      "index",
      `// const ${plural} = await ${model}.all();\nconst ${plural}${anyArr} = [];\nthis.render({ action: "index", locals: { ${plural} } });`,
      ts,
    ),
    mk(
      "show",
      `// const ${singular} = await ${model}.find(this.params.get("id"));\nthis.render({ action: "show", locals: { ${singular}: { id: this.params.get("id") } } });`,
      ts,
    ),
    mk("new_", `this.render({ action: "new", locals: { ${singular}: {} } });`, ts),
    mk(
      "create",
      `// const ${singular} = await ${model}.create(${params});\nvoid ${params};\nthis.redirectTo("/${plural}");`,
      ts,
    ),
    mk(
      "edit",
      `// const ${singular} = await ${model}.find(this.params.get("id"));\nthis.render({ action: "edit", locals: { ${singular}: { id: this.params.get("id") } } });`,
      ts,
    ),
    mk(
      "update",
      `// const ${singular} = await ${model}.find(this.params.get("id"));\n// await ${singular}.update(${params});\nvoid ${params};\nthis.redirectTo("/${plural}/" + this.params.get("id"));`,
      ts,
    ),
    mk(
      "destroy",
      `// const ${singular} = await ${model}.find(this.params.get("id"));\n// await ${singular}.destroy();\nthis.redirectTo("/${plural}");`,
      ts,
    ),
    paramsMethod(singular, attrs, ts),
  ];
}

function apiCrudMethods(
  model: string,
  singular: string,
  plural: string,
  attrs: string[],
  ts: boolean,
): Method[] {
  const anyArr = ts ? ": any[]" : "";
  const params = `this.${singular}Params()`;
  return [
    mk(
      "index",
      `// const ${plural} = await ${model}.all();\nconst ${plural}${anyArr} = [];\nthis.renderJson(${plural});`,
      ts,
    ),
    mk(
      "show",
      `// const ${singular} = await ${model}.find(this.params.get("id"));\nthis.renderJson({ id: this.params.get("id") });`,
      ts,
    ),
    mk(
      "create",
      `// const ${singular} = await ${model}.create(${params});\nthis.renderJson(${params}, { status: 201 });`,
      ts,
    ),
    mk(
      "update",
      `// const ${singular} = await ${model}.find(this.params.get("id"));\n// await ${singular}.update(${params});\nvoid ${params};\nthis.renderJson({ id: this.params.get("id") });`,
      ts,
    ),
    mk(
      "destroy",
      `// const ${singular} = await ${model}.find(this.params.get("id"));\n// await ${singular}.destroy();\nthis.head(204);`,
      ts,
    ),
  ];
}
