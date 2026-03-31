import { describe, it, expect } from "vitest";
import { templates } from "./templates.js";

describe("templates", () => {
  it("has at least 3 templates", () => {
    expect(templates.length).toBeGreaterThanOrEqual(3);
  });

  it("each template has a name, description, and files", () => {
    for (const t of templates) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.files.length).toBeGreaterThan(0);
    }
  });

  it("each file has a path and content", () => {
    for (const t of templates) {
      for (const f of t.files) {
        expect(f.path).toBeTruthy();
        expect(typeof f.content).toBe("string");
      }
    }
  });

  it("has a blank template", () => {
    expect(templates.some((t) => t.name === "blank")).toBe(true);
  });

  it("has a blog template with users/posts/comments", () => {
    const blog = templates.find((t) => t.name === "blog");
    expect(blog).toBeTruthy();
    const paths = blog!.files.map((f) => f.path);
    expect(paths.some((p) => p.includes("migrations"))).toBe(true);
    expect(paths.some((p) => p.includes("seeds"))).toBe(true);
  });

  it("has an e-commerce template with products/orders", () => {
    const ecom = templates.find((t) => t.name === "e-commerce");
    expect(ecom).toBeTruthy();
    const content = ecom!.files.map((f) => f.content).join("\n");
    expect(content).toContain("products");
    expect(content).toContain("orders");
  });

  it("has an api template", () => {
    expect(templates.some((t) => t.name === "api")).toBe(true);
  });

  it("migration files contain version and registerMigration", () => {
    for (const t of templates) {
      const migrationFiles = t.files.filter((f) => f.path.includes("migrations/"));
      for (const f of migrationFiles) {
        expect(f.content).toContain("version");
        expect(f.content).toContain("registerMigration");
      }
    }
  });

  it("no duplicate file paths within a template", () => {
    for (const t of templates) {
      const paths = t.files.map((f) => f.path);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });
});
