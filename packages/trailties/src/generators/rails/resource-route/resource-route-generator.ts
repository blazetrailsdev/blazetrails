import { pluralize } from "@blazetrails/activesupport";
import { NamedBase } from "../../named-base.js";

// Mirrors railties/lib/rails/generators/rails/resource_route/resource_route_generator.rb.
// Rails emits Ruby DSL via Thor's `route` action; trailties routes are TS,
// so this inserts `router.resources()` at the `// routes` marker in
// src/config/routes.{ts,js}. Nesting: admin/users/product → namespaced calls.
export interface ResourceRouteOptions {
  actions?: string[];
}

export class ResourceRouteGenerator extends NamedBase {
  addResourceRoute(options: ResourceRouteOptions = {}): void {
    if (options.actions && options.actions.length > 0) return;
    const routesFile = ["src/config/routes.ts", "src/config/routes.js"].find((f) =>
      this.fileExists(f),
    );
    if (!routesFile) return;
    const inner = `router.resources("${pluralize(this.fileName)}");`;
    const nested = this.classPathParts.reduceRight(
      (body, ns) => `router.namespace("${ns}", (router) => { ${body} });`,
      inner,
    );
    this.insertIntoFile(routesFile, "// routes", `  ${nested}\n`);
  }
}
