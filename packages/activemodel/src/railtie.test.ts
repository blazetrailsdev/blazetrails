import { describe, it, expect, afterEach } from "vitest";
import { Railtie } from "./railtie.js";
import { Railtie as BaseRailtie } from "@blazetrails/activesupport";
import { SecurePassword } from "./secure-password.js";
import { Error as ActiveModelError } from "./error.js";

describe("RailtieTest", () => {
  afterEach(() => {
    SecurePassword.minCost = false;
    ActiveModelError.i18nCustomizeFullMessage = false;
  });

  it("secure password min_cost is false in the development environment", () => {
    Railtie.initialize({ env: "development" });
    expect(SecurePassword.minCost).toBe(false);
  });

  it("secure password min_cost is true in the test environment", () => {
    Railtie.initialize({ env: "test" });
    expect(SecurePassword.minCost).toBe(true);
  });

  it("i18n customize full message defaults to false", () => {
    Railtie.initialize();
    expect(ActiveModelError.i18nCustomizeFullMessage).toBe(false);
  });

  it("i18n customize full message can be disabled", () => {
    ActiveModelError.i18nCustomizeFullMessage = true;
    Railtie.initialize();
    expect(ActiveModelError.i18nCustomizeFullMessage).toBe(false);
  });

  it("i18n customize full message can be enabled", () => {
    Railtie.initialize({ i18nCustomizeFullMessage: true });
    expect(ActiveModelError.i18nCustomizeFullMessage).toBe(true);
  });

  it("ActiveModel::Railtie is registered in the global subclasses list", () => {
    // Mirrors Rails::Railtie.subclasses which auto-populates via `inherited`.
    expect(BaseRailtie.subclasses).toContain(Railtie);
  });

  it("runInitializers applies the active_model.secure_password setting", () => {
    // Simulate a test environment via NODE_ENV so the initializer fires
    // the min_cost branch.
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      Railtie.runInitializers();
      expect(SecurePassword.minCost).toBe(true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
