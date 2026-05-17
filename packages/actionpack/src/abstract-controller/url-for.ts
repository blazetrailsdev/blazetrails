/**
 * `AbstractController::UrlFor` — includes `urlFor` into the host class
 * (an abstract controller or mailer). The host must provide a route
 * set by implementing the `_routes` static method. Otherwise calling
 * `urlFor` raises.
 *
 * Note that this module is completely decoupled from HTTP — the only
 * requirement is a valid `_routes` implementation.
 *
 * Ported from `vendor/rails/actionpack/lib/abstract_controller/url_for.rb`.
 * The deeper `ActionDispatch::Routing::UrlFor` mixin (which provides
 * the actual `urlFor` instance method) is **not yet ported**; until
 * then this module just declares the contract and the helper-name
 * filtering behavior used by `actionMethods`.
 */

export interface NamedRoutesLike {
  helperNames: readonly string[];
}

export interface RouteSetLike {
  namedRoutes: NamedRoutesLike;
}

/**
 * Static-side contract for `_routes`. Hosts that include UrlFor must
 * supply this on the class (mirrors Rails' `module ClassMethods; def
 * _routes; …; end; end`). Returning `null` is valid and means "no
 * routes wired up yet" — `actionMethods` then returns the unfiltered
 * action set.
 */
export interface UrlForClassMethods {
  _routes(): RouteSetLike | null;
}

const NO_ROUTES_MESSAGE =
  "In order to use #urlFor, you must include routing helpers explicitly. " +
  "For instance, `include Rails.application.routes.urlHelpers`.";

/**
 * Instance-side `_routes` stub — raises until the host overrides it.
 * Rails matches this behavior: trying to generate URLs before the
 * routes are wired up should fail loudly with a hint.
 */
export function _routes(this: object): never {
  throw new Error(NO_ROUTES_MESSAGE);
}

/**
 * Default static `_routes`: returns `null`. Hosts that get their
 * routes wired up later override this on the class (or via
 * `setRoutes`).
 */
export function _routesStatic(): RouteSetLike | null {
  return null;
}

/**
 * Filter `actionMethods` by removing any names that collide with
 * named-route helper names. Mirrors Rails' `ClassMethods#action_methods`
 * override: when `_routes` is wired up, the method list shrinks by
 * the helper names so routing helpers don't show up as actions.
 *
 * @param baseActionMethods The unfiltered action list (typically from
 *   `AbstractController.actionMethods()`).
 * @param routes The route set returned by `_routes`, or `null`.
 */
export function filterActionMethodsForRoutes(
  baseActionMethods: readonly string[],
  routes: RouteSetLike | null,
): string[] {
  if (!routes) return [...baseActionMethods];
  const helpers = new Set(routes.namedRoutes.helperNames);
  return baseActionMethods.filter((name) => !helpers.has(name));
}
