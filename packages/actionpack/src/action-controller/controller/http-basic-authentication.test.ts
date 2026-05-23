import { describe, it, expect } from "vitest";
import {
  encodeCredentials,
  authenticateOrRequestWithHttpBasic,
  requestHttpBasicAuthentication,
  httpBasicAuthenticateWith,
  type BasicControllerHost,
} from "../metal/http-authentication.js";

// Mirrors the minimal controller setup from Rails'
// HttpBasicAuthenticationTest (test/controller/http_basic_authentication_test.rb).
function makeController(authHeader?: string): BasicControllerHost {
  return {
    request: { authorization: authHeader },
    headers: {} as Record<string, string>,
    status: 200,
    responseBody: null,
  };
}

describe("HttpBasicAuthenticationTest", () => {
  it("successful authentication with ", () => {
    const c = makeController(encodeCredentials("lifo", "world"));
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user, pass) => user === "lifo" && pass === "world",
    );
    expect(result).toBe(true);
    expect(c.status).toBe(200);
  });

  it("successful authentication with  and long credentials", () => {
    const longPass = "x".repeat(1024);
    const c = makeController(encodeCredentials("lifo", longPass));
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user, pass) => user === "lifo" && pass === longPass,
    );
    expect(result).toBe(true);
  });

  it("unsuccessful authentication with ", () => {
    const c = makeController(encodeCredentials("lifo", "wrong"));
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user, pass) => user === "lifo" && pass === "world",
    );
    expect(result).toBe(false);
    expect(c.status).toBe(401);
  });

  it("unsuccessful authentication with  and long credentials", () => {
    const longPass = "x".repeat(1024);
    const c = makeController(encodeCredentials("lifo", longPass + "extra"));
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user, pass) => user === "lifo" && pass === longPass,
    );
    expect(result).toBe(false);
    expect(c.status).toBe(401);
  });

  it("unsuccessful authentication with  and no credentials", () => {
    const c = makeController();
    const result = authenticateOrRequestWithHttpBasic.call(c, "SuperSecret", null, () => true);
    expect(result).toBe(false);
    expect(c.status).toBe(401);
  });

  it("encode credentials has no newline", () => {
    const header = encodeCredentials("lifo", "world");
    expect(header).not.toMatch(/\n/);
  });

  it("successful authentication with uppercase authorization scheme", () => {
    const creds = encodeCredentials("lifo", "world").replace(/^Basic /, "BASIC ");
    const c = makeController(creds);
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user, pass) => user === "lifo" && pass === "world",
    );
    expect(result).toBe(true);
  });

  it("authentication request without credential", () => {
    const c = makeController();
    requestHttpBasicAuthentication.call(c, "SuperSecret");
    expect(c.status).toBe(401);
    expect(c.headers["WWW-Authenticate"]).toBe('Basic realm="SuperSecret"');
  });

  it("authentication request with invalid credential", () => {
    const c = makeController("Basic !!!not_valid_base64!!!");
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user, pass) => user === "lifo" && pass === "world",
    );
    expect(result).toBe(false);
    expect(c.status).toBe(401);
  });

  it("authentication request with a missing password", () => {
    const c = makeController(encodeCredentials("lifo", ""));
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (_user, pass) => pass === "world",
    );
    expect(result).toBe(false);
  });

  it("authentication request with no required password", () => {
    const c = makeController(encodeCredentials("lifo", ""));
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user) => user === "lifo",
    );
    expect(result).toBe(true);
    expect(c.status).toBe(200);
  });

  it("authentication request with valid credential", () => {
    const c = makeController(encodeCredentials("lifo", "world"));
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user, pass) => user === "lifo" && pass === "world",
    );
    expect(result).toBe(true);
    expect(c.status).toBe(200);
  });

  it("authentication request with valid credential special chars", () => {
    const c = makeController(encodeCredentials("ÂÑ", "ÂÑ"));
    const result = authenticateOrRequestWithHttpBasic.call(
      c,
      "SuperSecret",
      null,
      (user, pass) => user === "ÂÑ" && pass === "ÂÑ",
    );
    expect(result).toBe(true);
    expect(c.status).toBe(200);
  });

  it("authenticate with class method", () => {
    const beforeActionCalls: Array<(c: BasicControllerHost) => unknown> = [];
    const host = {
      beforeAction(cb: (c: BasicControllerHost) => unknown) {
        beforeActionCalls.push(cb);
      },
    };
    httpBasicAuthenticateWith.call(host, { name: "lifo", password: "world" });
    expect(beforeActionCalls).toHaveLength(1);
    const okCtrl = makeController(encodeCredentials("lifo", "world"));
    expect(beforeActionCalls[0](okCtrl)).toBe(true);
    const badCtrl = makeController(encodeCredentials("lifo", "wrong"));
    expect(beforeActionCalls[0](badCtrl)).toBe(false);
  });

  it("authentication request with wrong scheme", () => {
    const c = makeController("Token abc123");
    const result = authenticateOrRequestWithHttpBasic.call(c, "SuperSecret", null, () => true);
    expect(result).toBe(false);
    expect(c.status).toBe(401);
  });
});
