import { describe, it, expect } from "vitest";
import { Parser } from "./parser.js";
import { Ast } from "./ast.js";
import { Pattern } from "./path/pattern.js";
import { Terminal } from "./nodes/node.js";
import { Route } from "./route.js";

const SEPARATORS = "/.?";

function buildPath(
  path: string,
  requirements: Record<string, RegExp | RegExp[]> = {},
  separators: string = SEPARATORS,
  anchored = true,
): Pattern {
  const tree = new Parser().parse(path);
  const ast = new Ast(tree, true);
  return new Pattern(ast, requirements, separators, anchored);
}

function pathFromString(p: string) {
  return buildPath(p);
}

describe("ActionDispatch::Journey::Route", () => {
  it("test_initialize", () => {
    const app = { id: "app" };
    const path = pathFromString("/:controller(/:action(/:id(.:format)))");
    const defaults = {};
    const route = new Route({ name: "name", app, path, defaults });
    expect(route.app).toBe(app);
    expect(route.path).toBe(path);
    expect(route.defaults).toBe(defaults);
  });

  it("test_route_adds_itself_as_memo", () => {
    const app = { id: "app" };
    const path = pathFromString("/:controller(/:action(/:id(.:format)))");
    const route = new Route({ name: "name", app, path });
    for (const n of route.ast.grep(Terminal)) {
      expect(n.memo).toBe(route);
    }
  });

  it("test_path_requirements_override_defaults", () => {
    const path = buildPath(":name", { name: /love/ }, "/", true);
    const route = new Route({ name: "name", path, defaults: { name: "tender" } });
    expect((route.requirements["name"] as RegExp).source).toBe("love");
  });

  it("test_ip_address (string constraint)", () => {
    const path = pathFromString("/messages/:id(.:format)");
    const route = new Route({
      name: "name",
      path,
      constraints: { ip: "192.168.1.1" },
      defaults: { controller: "foo", action: "bar" },
    });
    expect(route.ip.test("192.168.1.1")).toBe(true);
  });

  it("test_default_ip", () => {
    const path = pathFromString("/messages/:id(.:format)");
    const route = new Route({
      name: "name",
      path,
      defaults: { controller: "foo", action: "bar" },
    });
    expect(route.ip.test("anything")).toBe(true);
  });

  it("test_format_with_star", () => {
    const path = pathFromString("/:controller/*extra");
    const route = new Route({
      name: "name",
      path,
      defaults: { controller: "foo", action: "bar" },
    });
    expect(route.format({ controller: "foo", extra: "himom" })).toBe("/foo/himom");
  });

  it("test_connects_all_match", () => {
    const path = pathFromString("/:controller(/:action(/:id(.:format)))");
    const route = new Route({
      name: "name",
      path,
      constraints: { action: "bar" },
      defaults: { controller: "foo" },
    });
    expect(route.format({ controller: "foo", action: "bar", id: 10 })).toBe("/foo/bar/10");
  });

  it("test_extras_are_not_included_if_optional", () => {
    const path = pathFromString("/page/:id(/:action)");
    const route = new Route({ name: "name", path, defaults: { action: "show" } });
    expect(route.format({ id: 10 })).toBe("/page/10");
  });

  it("test_extras_are_not_included_if_optional_with_parameter", () => {
    const path = pathFromString("(/sections/:section)/pages/:id");
    const route = new Route({ name: "name", path, defaults: { action: "show" } });
    expect(route.format({ id: 10 })).toBe("/pages/10");
  });

  it("test_extras_are_not_included_if_optional_parameter_is_nil", () => {
    const path = pathFromString("(/sections/:section)/pages/:id");
    const route = new Route({ name: "name", path, defaults: { action: "show" } });
    expect(route.format({ id: 10, section: null })).toBe("/pages/10");
  });

  it("test_score", () => {
    const defaults = { controller: "pages", action: "show" };

    const specificPath = pathFromString("/page/:id(/:action)(.:format)");
    const specific = new Route({
      name: "name",
      path: specificPath,
      requiredDefaults: ["controller", "action"],
      defaults,
    });

    const genericPath = pathFromString("/:controller(/:action(/:id))(.:format)");
    const generic = new Route({ name: "name", path: genericPath });

    const knowledge = new Set(["id", "controller", "action"]);
    expect(specific.score(knowledge)).not.toBe(generic.score(knowledge));
    const routes = [specific, generic];
    const found = [...routes].sort((a, b) => a.score(knowledge) - b.score(knowledge))[
      routes.length - 1
    ];
    expect(found).toBe(specific);
  });
});
