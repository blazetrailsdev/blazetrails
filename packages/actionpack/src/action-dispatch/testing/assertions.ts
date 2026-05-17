/**
 * ActionDispatch::Assertions
 *
 * Aggregates the test assertions provided by ActionDispatch. Mirrors
 * Rails' `action_dispatch/testing/assertions.rb` — currently exports
 * ResponseAssertions; RoutingAssertions follow once
 * `RouteSet#recognize_path` / `#generate_extras` are ported.
 */

export {
  assertResponse,
  assertRedirectedTo,
  type AssertionResponseHost,
  type AssertionResponseLike,
} from "./assertions/response.js";
