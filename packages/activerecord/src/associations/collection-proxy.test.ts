// Phase R.1: array-likeness on CollectionProxy / AssociationProxy.
//
// These tests exercise the additive surface that makes an
// AssociationProxy a drop-in for the Base[] reader collection
// associations return today. No reader change yet — these methods
// just exist on the proxy returned by `association(record, name)`.

import { describe, it, expect, beforeEach } from "vitest";
import { Base, association, registerModel } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("CollectionProxy — array-likeness (Phase R.1)", () => {
  let adapter: DatabaseAdapter;

  class ApBlog extends Base {
    declare name: string;
    declare apPosts: ApPost[];

    static {
      this.attribute("name", "string");
    }
  }

  class ApPost extends Base {
    declare apBlogId: number | null;
    declare title: string;

    static {
      this.attribute("title", "string");
      this.attribute("ap_blog_id", "integer");
    }
  }

  // hasMany must be set up after both classes exist so the inflection
  // can find ApPost in the model registry.
  ApBlog.hasMany("apPosts", { className: "ApPost" });

  beforeEach(() => {
    adapter = createTestAdapter();
    ApBlog.adapter = adapter;
    ApPost.adapter = adapter;
    registerModel(ApBlog);
    registerModel(ApPost);
  });

  async function blogWithPosts(): Promise<ApBlog> {
    const blog = new ApBlog({ name: "Dev" });
    await blog.save();
    for (const title of ["a", "b", "c"]) {
      const p = new ApPost({ title, ap_blog_id: blog.id as number });
      await p.save();
    }
    const proxy = association<ApPost>(blog, "apPosts");
    await proxy.load();
    return blog;
  }

  it("exposes `length` against the loaded target", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    expect(proxy.length).toBe(3);
  });

  it("is iterable via `for ... of`", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    const titles: string[] = [];
    for (const p of proxy) titles.push(p.title);
    expect(titles).toEqual(["a", "b", "c"]);
  });

  it("supports numeric indexing (proxy[0])", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts") as any;
    expect(proxy[0].title).toBe("a");
    expect(proxy[2].title).toBe("c");
    expect(proxy[99]).toBeUndefined();
  });

  it("at(index) returns the record or undefined", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    expect(proxy.at(0)?.title).toBe("a");
    expect(proxy.at(-1)?.title).toBe("c");
    expect(proxy.at(99)).toBeUndefined();
  });

  it("map / filter / forEach delegate to the target", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    expect(proxy.map((p) => p.title)).toEqual(["a", "b", "c"]);
    expect(proxy.filter((p) => p.title !== "b").map((p) => p.title)).toEqual(["a", "c"]);
    const seen: string[] = [];
    proxy.forEach((p) => seen.push(p.title));
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("some / every / includes work", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    expect(proxy.some((p) => p.title === "b")).toBe(true);
    expect(proxy.every((p) => p.title.length === 1)).toBe(true);
    const first = proxy.at(0)!;
    expect(proxy.includes(first)).toBe(true);
  });

  it("slice returns a plain array shallow copy", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    const head = proxy.slice(0, 2);
    expect(head.map((p) => p.title)).toEqual(["a", "b"]);
    expect(Array.isArray(head)).toBe(true);
  });

  it("reduce composes over the target", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    const concatenated = proxy.reduce((acc, p) => acc + p.title, "");
    expect(concatenated).toBe("abc");
  });

  it("indexOf / flatMap work", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    const second = proxy.at(1)!;
    expect(proxy.indexOf(second)).toBe(1);
    expect(proxy.flatMap((p) => [p.title, p.title.toUpperCase()])).toEqual([
      "a",
      "A",
      "b",
      "B",
      "c",
      "C",
    ]);
  });

  it("array spread reads the loaded target", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    const titles = [...proxy].map((p) => p.title);
    expect(titles).toEqual(["a", "b", "c"]);
  });

  it("Array.from reads the loaded target", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    expect(Array.from(proxy).length).toBe(3);
  });

  it("await still resolves to the loaded array (thenable preserved)", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    const arr = await proxy;
    expect(arr.map((p) => p.title)).toEqual(["a", "b", "c"]);
  });

  it("keys / values / entries work", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    expect([...proxy.keys()]).toEqual([0, 1, 2]);
    expect([...proxy.values()].map((p) => p.title)).toEqual(["a", "b", "c"]);
    expect([...proxy.entries()].map(([i, p]) => `${i}:${p.title}`)).toEqual(["0:a", "1:b", "2:c"]);
  });

  it("Array.isArray returns false on the proxy (known limitation)", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts");
    // `Array.isArray` checks an internal slot that proxies cannot fake.
    // Consumers of the post-R.2 reader who branch on Array.isArray must
    // reach for the loaded target via `await` or `Array.from(...)`.
    expect(Array.isArray(proxy)).toBe(false);
    expect(Array.isArray(Array.from(proxy))).toBe(true);
  });

  it("does NOT shadow Relation#find (PK lookup) with Array#find", async () => {
    const blog = await blogWithPosts();
    const proxy = association<ApPost>(blog, "apPosts") as any;
    // `find` falls through to Relation, which interprets it as a PK lookup.
    // We intentionally don't add Array#find on CollectionProxy — Rails
    // gives Relation#find the same priority.
    const found = await proxy.find(blog.apPosts[0]?.id);
    expect(found?.title).toBe("a");
  });
});
