import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntegrationTest } from "../../action-dispatch/testing/integration.js";
import { Base } from "../base.js";

// ==========================================================================
// SessionTest
// ==========================================================================
describe("SessionTest", () => {
  let session: IntegrationTest;

  beforeEach(() => {
    session = new IntegrationTest();
  });

  it("test_https_bang_works_and_sets_truth_by_default", () => {
    expect(session.isHttps()).toBe(false);
    session.httpsBang();
    expect(session.isHttps()).toBe(true);
    session.httpsBang(false);
    expect(session.isHttps()).toBe(false);
  });

  it("test_host!", () => {
    expect(session.host).not.toBe("glu.ttono.us");
    session.host = "rubyonrails.com";
    expect(session.host).toBe("rubyonrails.com");
  });

  it("test_follow_redirect_raises_when_no_redirect", async () => {
    await expect(session.followRedirect()).rejects.toThrow();
  });

  it("test_get", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.get(path, { params, headers });
    expect(spy).toHaveBeenCalledWith("GET", path, { params, headers });
  });

  it("test_get_with_env_and_headers", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    const env = { HTTP_X_REQUESTED_WITH: "XMLHttpRequest" };
    await session.get(path, { params, headers, env });
    expect(spy).toHaveBeenCalledWith("GET", path, { params, headers, env });
  });

  it("test_post", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.post(path, { params, headers });
    expect(spy).toHaveBeenCalledWith("POST", path, { params, headers });
  });

  it("test_patch", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.patch(path, { params, headers });
    expect(spy).toHaveBeenCalledWith("PATCH", path, { params, headers });
  });

  it("test_put", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.put(path, { params, headers });
    expect(spy).toHaveBeenCalledWith("PUT", path, { params, headers });
  });

  it("test_delete", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.delete(path, { params, headers });
    expect(spy).toHaveBeenCalledWith("DELETE", path, { params, headers });
  });

  it("test_head", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.head(path, { params, headers });
    expect(spy).toHaveBeenCalledWith("HEAD", path, { params, headers });
  });

  it("test_xml_http_request_get", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.get(path, { params, headers, xhr: true });
    expect(spy).toHaveBeenCalledWith("GET", path, { params, headers, xhr: true });
  });

  it("test_xml_http_request_post", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.post(path, { params, headers, xhr: true });
    expect(spy).toHaveBeenCalledWith("POST", path, { params, headers, xhr: true });
  });

  it("test_xml_http_request_patch", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.patch(path, { params, headers, xhr: true });
    expect(spy).toHaveBeenCalledWith("PATCH", path, { params, headers, xhr: true });
  });

  it("test_xml_http_request_put", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.put(path, { params, headers, xhr: true });
    expect(spy).toHaveBeenCalledWith("PUT", path, { params, headers, xhr: true });
  });

  it("test_xml_http_request_delete", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.delete(path, { params, headers, xhr: true });
    expect(spy).toHaveBeenCalledWith("DELETE", path, { params, headers, xhr: true });
  });

  it("test_xml_http_request_head", async () => {
    const spy = vi.spyOn(session, "process").mockResolvedValue(0);
    const path = "/index";
    const params = { q: "blah" };
    const headers = { location: "blah" };
    await session.head(path, { params, headers, xhr: true });
    expect(spy).toHaveBeenCalledWith("HEAD", path, { params, headers, xhr: true });
  });
});

// ==========================================================================
// IntegrationTestTest
// ==========================================================================
describe("IntegrationTestTest", () => {
  let test: IntegrationTest;

  beforeEach(() => {
    test = new IntegrationTest();
  });

  it("test_opens_new_session", () => {
    const session1 = test.openSession();
    const session2 = test.openSession();
    expect(session1).not.toBe(session2);
  });

  it("test_child_session_assertions_bubble_up_to_root", () => {
    const assertionsBefore = test.assertions;
    test.openSession().assertions += 1;
    expect(test.assertions - assertionsBefore).toBe(1);
  });

  it.skip("test_does_not_prevent_method_missing_passing_up_to_ancestors", () => {
    // Ruby-specific: method_missing has no TypeScript equivalent.
  });
});

// ==========================================================================
// RackLintIntegrationTest
// ==========================================================================
describe("RackLintIntegrationTest", () => {
  it.skip("integration test follows rack SPEC", () => {
    // Requires Rack::Lint middleware — no TS equivalent yet.
  });
});

// ==========================================================================
// MetalIntegrationTest
// ==========================================================================
class PollerController extends Base {
  async call() {
    const path = this.request?.env?.PATH_INFO as string;
    if (path?.startsWith("/success")) {
      this.render({ plain: "Hello World!", status: 200 });
    } else {
      this.render({ plain: "", status: 404 });
    }
  }
}

describe("MetalIntegrationTest", () => {
  let t: IntegrationTest;

  beforeEach(() => {
    t = new IntegrationTest();
    t.routes.draw((r) => {
      r.get("/success", { to: "poller#call" });
      r.get("/failure", { to: "poller#call" });
    });
    t.registerController("poller", PollerController);
  });

  it("test_successful_get", async () => {
    await t.get("/success");
    t.assertResponse(200);
    t.assertResponse("success");
    t.assertResponse("ok");
    expect(t.responseBody).toBe("Hello World!");
  });

  it("test_failed_get", async () => {
    await t.get("/failure");
    t.assertResponse(404);
    t.assertResponse("not_found");
    expect(t.responseBody).toBe("");
  });

  it.skip("test_generate_url_without_controller", () => {
    // Requires url_for with SharedTestRoutes wired — not yet ported.
  });

  it("test_pass_headers", async () => {
    await t.get("/success", {
      headers: { Referer: "http://www.example.com/foo", Host: "http://nohost.com" },
    });
    expect(t.request.env["HTTP_HOST"]).toBe("http://nohost.com");
    expect(t.request.env["HTTP_REFERER"]).toBe("http://www.example.com/foo");
  });

  it("test_pass_headers_and_env", async () => {
    await t.get("/success", {
      headers: { "X-Test-Header": "value" },
      env: { HTTP_REFERER: "http://test.com/", HTTP_HOST: "http://test.com" },
    });
    expect(t.request.env["HTTP_HOST"]).toBe("http://test.com");
    expect(t.request.env["HTTP_REFERER"]).toBe("http://test.com/");
    expect(t.request.env["HTTP_X_TEST_HEADER"]).toBe("value");
  });

  it("test_pass_env", async () => {
    await t.get("/success", {
      env: { HTTP_REFERER: "http://test.com/", HTTP_HOST: "http://test.com" },
    });
    expect(t.request.env["HTTP_HOST"]).toBe("http://test.com");
    expect(t.request.env["HTTP_REFERER"]).toBe("http://test.com/");
  });

  it("test_ignores_common_ports_in_host", async () => {
    await t.get("http://test.com");
    expect(t.request.env["HTTP_HOST"]).toBe("test.com");

    await t.get("https://test.com");
    expect(t.request.env["HTTP_HOST"]).toBe("test.com");
  });

  it("test_keeps_uncommon_ports_in_host", async () => {
    await t.get("http://test.com:123");
    expect(t.request.env["HTTP_HOST"]).toBe("test.com:123");

    await t.get("http://test.com:443");
    expect(t.request.env["HTTP_HOST"]).toBe("test.com:443");

    await t.get("https://test.com:80");
    expect(t.request.env["HTTP_HOST"]).toBe("test.com:80");
  });
});
