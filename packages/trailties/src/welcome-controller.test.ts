import { describe, it, expect } from "vitest";
import { WelcomeController } from "./welcome-controller.js";

describe("WelcomeController", () => {
  it("layout is disabled (Rails: `layout false`)", () => {
    expect(WelcomeController.layout).toBe(false);
  });

  it("index is a no-op (implicit render of welcome/index)", () => {
    const c = new WelcomeController();
    expect(() => c.index()).not.toThrow();
  });
});
