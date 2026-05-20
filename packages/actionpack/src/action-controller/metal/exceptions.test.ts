import { describe, it, expect } from "vitest";
import { UrlGenerationError } from "./exceptions.js";

function makeRoutes(helperNames: string[]) {
  return { namedRoutes: { helperNames } };
}

describe("UrlGenerationError#corrections", () => {
  it("suggests near-match named-route helpers via SpellChecker", () => {
    // Rails first greps `helper_names` by /route_name/ — so the dictionary
    // is helpers whose name contains the (mistyped) route_name as a
    // substring. SpellChecker then ranks them against route_name itself.
    const err = new UrlGenerationError(
      "No route matches",
      makeRoutes(["userPath", "newUserPath", "userPathHelper", "loginPath"]),
      "userPath",
      "userPath",
    );
    // userPath itself is excluded by the method_name guard; only
    // userPathHelper substring-matches the route_name regex (capitalisation
    // matters — newUserPath / loginPath don't contain literal "userPath").
    expect(err.corrections).toEqual(["userPathHelper"]);
  });

  it("excludes the failing methodName from the dictionary (Rails: maybe_these -= [method_name])", () => {
    const err = new UrlGenerationError(
      "No route matches",
      makeRoutes(["userPath", "userPathHelper"]),
      "userPath",
      "userPath",
    );
    expect(err.corrections).not.toContain("userPath");
  });

  it("returns [] when no routes are attached", () => {
    expect(new UrlGenerationError("x").corrections).toEqual([]);
  });

  it("returns [] when no helper grep-matches the routeName", () => {
    const err = new UrlGenerationError(
      "No route matches",
      makeRoutes(["loginPath", "logoutPath"]),
      "userPath",
      null,
    );
    expect(err.corrections).toEqual([]);
  });

  it("memoises across reads", () => {
    const err = new UrlGenerationError(
      "x",
      makeRoutes(["userPath", "userPathHelper"]),
      "userPath",
      "missing",
    );
    const first = err.corrections;
    expect(err.corrections).toBe(first);
  });
});
