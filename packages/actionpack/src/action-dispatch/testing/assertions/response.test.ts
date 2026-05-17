import { describe, expect, it } from "vitest";
import { assertResponse, assertRedirectedTo, type AssertionResponseHost } from "./response.js";

function host(
  status: number,
  headers: Record<string, string> = {},
  body = "",
): AssertionResponseHost {
  return {
    response: {
      status,
      body,
      getHeader: (k) => headers[k.toLowerCase()],
    },
  };
}

describe("assertResponse", () => {
  it("passes for matching range symbol", () => {
    expect(() => assertResponse.call(host(200), "success")).not.toThrow();
    expect(() => assertResponse.call(host(404), "missing")).not.toThrow();
    expect(() => assertResponse.call(host(302), "redirect")).not.toThrow();
    expect(() => assertResponse.call(host(503), "error")).not.toThrow();
  });

  it("fails for mismatched range symbol", () => {
    expect(() => assertResponse.call(host(404), "success")).toThrow(/Expected response/);
  });

  it("passes for matching explicit numeric code", () => {
    expect(() => assertResponse.call(host(422), 422)).not.toThrow();
  });

  it("passes for matching Rack status symbol", () => {
    expect(() => assertResponse.call(host(401), "unauthorized")).not.toThrow();
  });

  it("fails for mismatched explicit code", () => {
    expect(() => assertResponse.call(host(200), 404)).toThrow(/<404: missing>/);
  });

  it("uses provided message", () => {
    expect(() => assertResponse.call(host(200), "missing", "custom")).toThrow("custom");
  });
});

describe("assertRedirectedTo", () => {
  it("passes when location matches exact string", () => {
    expect(() => assertRedirectedTo.call(host(302, { location: "/foo" }), "/foo")).not.toThrow();
  });

  it("passes when location matches regex", () => {
    expect(() =>
      assertRedirectedTo.call(host(302, { location: "http://example.org/x" }), /example\.org/),
    ).not.toThrow();
  });

  it("fails when not a redirect", () => {
    expect(() => assertRedirectedTo.call(host(200, { location: "/foo" }), "/foo")).toThrow();
  });

  it("fails when location does not match", () => {
    expect(() => assertRedirectedTo.call(host(302, { location: "/bar" }), "/foo")).toThrow(
      /redirect to <\/foo>/,
    );
  });

  it("honors status override option", () => {
    expect(() =>
      assertRedirectedTo.call(host(301, { location: "/foo" }), "/foo", {
        status: "moved_permanently",
      }),
    ).not.toThrow();
  });
});
