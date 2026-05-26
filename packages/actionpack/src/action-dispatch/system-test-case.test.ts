import { describe, it, expect } from "vitest";
import { SystemTestCase, DEFAULT_HOST } from "./system-test-case.js";

describe("ActionDispatch::SystemTestCase", () => {
  it("has DEFAULT_HOST constant", () => {
    expect(DEFAULT_HOST).toBe("http://127.0.0.1");
  });

  it("drivenBy configures a driver", () => {
    SystemTestCase.drivenBy("playwright", { using: "chromium" });
    expect(SystemTestCase.driver).toBeDefined();
    expect(SystemTestCase.driver!.name).toBe("playwright");
  });

  it("servedBy accepts host and port", () => {
    expect(() => SystemTestCase.servedBy({ host: "localhost", port: 3000 })).not.toThrow();
  });

  it("constructor defaults driver to playwright if not set", () => {
    SystemTestCase.driver = undefined;
    new SystemTestCase();
    expect(SystemTestCase.driver).toBeDefined();
    expect(SystemTestCase.driver!.name).toBe("playwright");
  });
});
