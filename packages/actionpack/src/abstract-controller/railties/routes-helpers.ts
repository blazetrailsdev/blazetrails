/**
 * `AbstractController::Railties::RoutesHelpers` — factory that
 * produces a per-class wiring step. The Rails version returns an
 * anonymous `Module` whose `inherited(klass)` hook walks
 * `klass.module_parents` for a namespace exposing
 * `railtie_routes_url_helpers` and includes the appropriate URL-helper
 * module into the subclass; if no namespace has one, it falls back to
 * `routes.url_helpers(include_path_helpers)`.
 *
 * TS has no `inherited` trigger and no `module_parents` traversal, so
 * the factory returns a *function* the host calls on each new
 * subclass. The namespace lookup is replaced by an optional
 * `railtieRoutesUrlHelpers` slot on the class itself; absence falls
 * through to `routes.urlHelpers(includePathHelpers)`.
 *
 * Ported from `vendor/rails/actionpack/lib/abstract_controller/railties/routes_helpers.rb`.
 *
 * @internal
 */

import { helper, type HelperMethodsModule, type HelpersClassMethods } from "../helpers.js";

/**
 * Minimum shape this factory needs from a route set. Once a real
 * `RouteSet` lands in `action-dispatch/routing`, that class can
 * implement this interface directly.
 */
export interface UrlHelpersRouteSet {
  urlHelpers(includePathHelpers?: boolean): HelperMethodsModule;
}

/**
 * Optional class-level slot: if a host class (or one of its
 * inheritance chain ancestors) wants to override the inherited
 * url-helper module, it sets `railtieRoutesUrlHelpers` to a builder
 * function. Mirrors the Rails `respond_to?(:railtie_routes_url_helpers)`
 * branch.
 */
export interface RoutesHelpersClassMethods extends HelpersClassMethods {
  railtieRoutesUrlHelpers?(includePathHelpers?: boolean): HelperMethodsModule;
}

/**
 * `RoutesHelpers.with(routes, include_path_helpers)` — returns a
 * subclass-init function. Hosts invoke the returned function with the
 * new controller class to wire its URL helpers.
 *
 *     const wire = withRoutesHelpers(routes);
 *     wire(PostsController);
 */
export function withRoutesHelpers(
  routes: UrlHelpersRouteSet,
  includePathHelpers = true,
): (cls: RoutesHelpersClassMethods) => void {
  return (cls) => {
    // Rails: walk module_parents for the first namespace that
    // responds to railtie_routes_url_helpers. We approximate by
    // walking the class's own prototype chain (static-side
    // inheritance) and picking the nearest one with that slot.
    const namespaceBuilder = findRailtieUrlHelpers(cls);
    const mod = namespaceBuilder
      ? namespaceBuilder(includePathHelpers)
      : routes.urlHelpers(includePathHelpers);
    helper(cls, mod);
  };
}

function findRailtieUrlHelpers(
  cls: RoutesHelpersClassMethods,
): RoutesHelpersClassMethods["railtieRoutesUrlHelpers"] {
  let current: object | null = cls;
  while (current) {
    const own = Object.getOwnPropertyDescriptor(current, "railtieRoutesUrlHelpers")?.value as
      | RoutesHelpersClassMethods["railtieRoutesUrlHelpers"]
      | undefined;
    if (typeof own === "function") return own;
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}
