/**
 * ActionDispatch::Assertions — aggregates the test assertions provided by
 * ActionDispatch. Mirrors `action_dispatch/testing/assertions.rb`.
 * `withRouting` and `htmlDocument` follow as separate PRs.
 */

export {
  assertResponse,
  assertRedirectedTo,
  parameterize,
  normalizeArgumentToRedirection,
  type AssertionResponseHost,
  type AssertionResponseLike,
} from "./assertions/response.js";

export {
  assertRecognizes,
  assertGenerates,
  assertRouting,
  recognizedRequestFor,
  type RoutingAssertionsHost,
  type PathWithMethod,
} from "./assertions/routing.js";
