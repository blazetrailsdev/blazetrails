import { describe, it, expect } from "vitest";
import { tutorials, getTutorial } from "./registry.js";

describe("tutorial registry", () => {
  it("has 3 tutorials", () => {
    expect(tutorials).toHaveLength(3);
  });

  it("each tutorial has required fields", () => {
    for (const t of tutorials) {
      expect(t.slug).toBeTruthy();
      expect(t.title).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.stepCount).toBeGreaterThan(0);
      expect(typeof t.loadSteps).toBe("function");
    }
  });

  it("getTutorial returns correct entry by slug", () => {
    const docs = getTutorial("docs");
    expect(docs?.slug).toBe("docs");
    expect(docs?.title).toBe("Getting Started");

    const music = getTutorial("music");
    expect(music?.slug).toBe("music");

    const finances = getTutorial("finances");
    expect(finances?.slug).toBe("finances");
  });

  it("getTutorial returns undefined for unknown slug", () => {
    expect(getTutorial("unknown")).toBeUndefined();
  });

  it("docs tutorial steps load successfully", async () => {
    const docs = getTutorial("docs")!;
    const steps = await docs.loadSteps();
    expect(steps.length).toBeGreaterThan(0);
  });

  it("docs tutorial first step has required structure", async () => {
    const docs = getTutorial("docs")!;
    const steps = await docs.loadSteps();
    const step = steps[0];
    expect(step.title).toBeTruthy();
    expect(step.panes.length).toBeGreaterThan(0);
    expect(step.description.length).toBeGreaterThan(0);
    expect(step.actions.length).toBeGreaterThan(0);
    expect(step.checkpoint.length).toBeGreaterThan(0);
  });

  it("docs tutorial step 1 has a diagram", async () => {
    const docs = getTutorial("docs")!;
    const steps = await docs.loadSteps();
    expect(steps[0].diagram).toBeTruthy();
    expect(steps[0].diagramLabel).toBeTruthy();
  });

  it("docs tutorial step 2 introduces database pane", async () => {
    const docs = getTutorial("docs")!;
    const steps = await docs.loadSteps();
    expect(steps[0].panes).not.toContain("database");
    expect(steps[1].panes).toContain("database");
  });

  it("music tutorial throws not-yet-available", async () => {
    const music = getTutorial("music")!;
    await expect(music.loadSteps()).rejects.toThrow("not yet available");
  });

  it("tutorials have unique slugs", () => {
    const slugs = tutorials.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
