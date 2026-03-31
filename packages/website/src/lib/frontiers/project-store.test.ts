import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { ProjectStore } from "./project-store.js";

let store: ProjectStore;

beforeEach(() => {
  // fake-indexeddb/auto polyfills globalThis.indexedDB
  // Each test gets a fresh store (but shares the same IDB — use unique names)
  store = new ProjectStore();
});

describe("ProjectStore", () => {
  it("starts empty", async () => {
    const list = await store.list();
    expect(list).toEqual([]);
  });

  it("saves and loads a project", async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    await store.save("test-project", data);

    const loaded = await store.load("test-project");
    expect(loaded).toEqual(data);
  });

  it("lists projects sorted by updatedAt descending", async () => {
    await store.save("alpha", new Uint8Array([1]));
    // small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await store.save("beta", new Uint8Array([2]));

    const list = await store.list();
    expect(list.length).toBeGreaterThanOrEqual(2);
    // beta was saved later, should be first
    const names = list.map((p) => p.name);
    expect(names.indexOf("beta")).toBeLessThan(names.indexOf("alpha"));
  });

  it("returns size in metadata", async () => {
    await store.save("sized", new Uint8Array(100));
    const list = await store.list();
    const item = list.find((p) => p.name === "sized");
    expect(item).toBeTruthy();
    expect(item!.size).toBe(100);
  });

  it("updates an existing project", async () => {
    await store.save("mutable", new Uint8Array([1]));
    await store.save("mutable", new Uint8Array([2, 3]));

    const loaded = await store.load("mutable");
    expect(loaded).toEqual(new Uint8Array([2, 3]));

    // Should still be one entry, not two
    const list = await store.list();
    expect(list.filter((p) => p.name === "mutable")).toHaveLength(1);
  });

  it("preserves createdAt on update", async () => {
    await store.save("preserved", new Uint8Array([1]));
    const list1 = await store.list();
    const created = list1.find((p) => p.name === "preserved")!.createdAt;

    await new Promise((r) => setTimeout(r, 10));
    await store.save("preserved", new Uint8Array([2]));
    const list2 = await store.list();
    const item = list2.find((p) => p.name === "preserved")!;
    expect(item.createdAt).toBe(created);
  });

  it("deletes a project", async () => {
    await store.save("deleteme", new Uint8Array([1]));
    await store.delete("deleteme");
    const loaded = await store.load("deleteme");
    expect(loaded).toBeNull();
  });

  it("exists returns true for saved project", async () => {
    await store.save("exists-test", new Uint8Array([1]));
    expect(await store.exists("exists-test")).toBe(true);
  });

  it("exists returns false for missing project", async () => {
    expect(await store.exists("nope")).toBe(false);
  });

  it("load returns null for missing project", async () => {
    const loaded = await store.load("nonexistent");
    expect(loaded).toBeNull();
  });
});
