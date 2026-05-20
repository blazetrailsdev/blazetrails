import { describe, it, expect, vi } from "vitest";
import { PWAController } from "./pwa-controller.js";

describe("PWAController", () => {
  it("service_worker renders the pwa/service-worker template without a layout", () => {
    const c = new PWAController();
    const render = vi.fn();
    (c as unknown as { render: typeof render }).render = render;
    c.serviceWorker();
    expect(render).toHaveBeenCalledWith({ template: "pwa/service-worker", layout: false });
  });

  it("manifest renders the pwa/manifest template without a layout", () => {
    const c = new PWAController();
    const render = vi.fn();
    (c as unknown as { render: typeof render }).render = render;
    c.manifest();
    expect(render).toHaveBeenCalledWith({ template: "pwa/manifest", layout: false });
  });
});
