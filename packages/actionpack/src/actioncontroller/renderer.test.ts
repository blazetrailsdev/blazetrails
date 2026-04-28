import { describe, it, expect } from "vitest";
import { Renderer } from "./renderer.js";

describe("Renderer", () => {
  describe("envForRequest", () => {
    it("returns a copy of defaults when HTTP_HOST is present", () => {
      const defaults = {
        HTTP_HOST: "example.com",
        REQUEST_METHOD: "GET",
      };
      const renderer = new Renderer({}, defaults);

      // Use reflection to access private method for testing
      const env = (renderer as any).envForRequest();

      expect(env).toEqual(defaults);
      expect(env).not.toBe(defaults); // Should be a copy, not the same object
    });

    it("returns a copy of defaults when routes are unavailable", () => {
      const defaults = {
        REQUEST_METHOD: "POST",
      };
      const renderer = new Renderer({}, defaults);

      // Controller without _routes
      const env = (renderer as any).envForRequest();

      expect(env).toEqual(defaults);
      expect(env).not.toBe(defaults);
    });

    it("merges controller default_env with defaults when routes available and no HTTP_HOST", () => {
      const defaults = {
        REQUEST_METHOD: "GET",
      };
      const controller = {
        _routes: {
          defaultEnv: {
            HTTP_HOST: "default.example.com",
            SCRIPT_NAME: "/app",
          },
        },
      };
      const renderer = new Renderer(controller, defaults);

      const env = (renderer as any).envForRequest();

      // defaults should override defaultEnv
      expect(env).toEqual({
        HTTP_HOST: "default.example.com",
        SCRIPT_NAME: "/app",
        REQUEST_METHOD: "GET",
      });
    });

    it("prefers defaults over controller defaultEnv", () => {
      const defaults = {
        REQUEST_METHOD: "POST",
        HTTP_HOST: "override.example.com",
      };
      const controller = {
        _routes: {
          defaultEnv: {
            HTTP_HOST: "default.example.com",
            REQUEST_METHOD: "GET",
          },
        },
      };
      const renderer = new Renderer(controller, defaults);

      const env = (renderer as any).envForRequest();

      // When HTTP_HOST is in defaults, defaults should be returned as-is
      expect(env.HTTP_HOST).toBe("override.example.com");
      expect(env.REQUEST_METHOD).toBe("POST");
    });
  });

  describe("normalizeEnv", () => {
    it("translates https boolean to on/off string", () => {
      const result = Renderer.normalizeEnv({ https: true });
      expect(result.HTTPS).toBe("on");

      const result2 = Renderer.normalizeEnv({ https: false });
      expect(result2.HTTPS).toBe("off");
    });

    it("uppercases method", () => {
      const result = Renderer.normalizeEnv({ method: "get" });
      expect(result.REQUEST_METHOD).toBe("GET");

      const result2 = Renderer.normalizeEnv({ method: "post" });
      expect(result2.REQUEST_METHOD).toBe("POST");
    });

    it("translates known rack keys", () => {
      const result = Renderer.normalizeEnv({
        http_host: "example.com",
        script_name: "/app",
        input: "stdin",
      });
      expect(result.HTTP_HOST).toBe("example.com");
      expect(result.SCRIPT_NAME).toBe("/app");
      expect(result["rack.input"]).toBe("stdin");
    });

    it("sets HTTPS to off when HTTP_HOST is present without HTTPS", () => {
      const result = Renderer.normalizeEnv({ http_host: "example.com" });
      expect(result.HTTPS).toBe("off");
    });

    it("sets SCRIPT_NAME to empty string when HTTP_HOST is present without SCRIPT_NAME", () => {
      const result = Renderer.normalizeEnv({ http_host: "example.com" });
      expect(result.SCRIPT_NAME).toBe("");
    });

    it("sets rack.url_scheme based on HTTPS", () => {
      const result = Renderer.normalizeEnv({
        http_host: "example.com",
        https: true,
      });
      expect(result["rack.url_scheme"]).toBe("https");

      const result2 = Renderer.normalizeEnv({
        http_host: "example.com",
        https: false,
      });
      expect(result2["rack.url_scheme"]).toBe("http");
    });
  });
});
