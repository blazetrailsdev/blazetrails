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

  it("servedBy sets host and port", () => {
    expect(() => SystemTestCase.servedBy({ host: "localhost", port: 3000 })).not.toThrow();
  });

  it("constructor defaults driver if not set", () => {
    SystemTestCase.driver = undefined;
    new SystemTestCase();
    expect(SystemTestCase.driver).toBeDefined();
  });

  it("page throws before setup", () => {
    const testCase = new SystemTestCase();
    expect(() => testCase.page).toThrow("No page available");
  });

  it("context throws before setup", () => {
    const testCase = new SystemTestCase();
    expect(() => testCase.context).toThrow("No browser context available");
  });
});
