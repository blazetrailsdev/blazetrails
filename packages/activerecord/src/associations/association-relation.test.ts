// AssociationRelation — writes on a relation produced by a collection
// association should route through the owner so the foreign key, inverse,
// and loaded target stay wired up. Mirrors Rails'
// ActiveRecord::AssociationRelation behavior.

import { describe, it, expect, beforeEach } from "vitest";
import { Base, association, registerModel, AssociationRelation } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("AssociationRelation", () => {
  let adapter: DatabaseAdapter;

  class ArBlog extends Base {
    declare name: string;
    static {
      this.attribute("name", "string");
    }
  }

  class ArPost extends Base {
    declare ar_blog_id: number | null;
    declare title: string;
    declare published: boolean;
    static {
      this.attribute("title", "string");
      this.attribute("published", "boolean", { default: false });
      this.attribute("ar_blog_id", "integer");
    }
  }

  ArBlog.hasMany("arPosts", { className: "ArPost" });

  beforeEach(() => {
    adapter = createTestAdapter();
    ArBlog.adapter = adapter;
    ArPost.adapter = adapter;
    registerModel(ArBlog);
    registerModel(ArPost);
  });

  async function freshBlog(): Promise<ArBlog> {
    const blog = new ArBlog({ name: "Dev" });
    await blog.save();
    return blog;
  }

  it("returns an AssociationRelation from the collection proxy", async () => {
    const blog = await freshBlog();
    const proxy = association<ArPost>(blog, "arPosts");
    const scope = proxy.where({ published: true });
    expect(scope).toBeInstanceOf(AssociationRelation);
  });

  it("preserves AssociationRelation through chained query methods", async () => {
    const blog = await freshBlog();
    const proxy = association<ArPost>(blog, "arPosts");
    const chained = proxy.where({ published: true }).order("title").limit(5);
    expect(chained).toBeInstanceOf(AssociationRelation);
  });

  it("create on an association relation sets the owner's foreign key", async () => {
    const blog = await freshBlog();
    const proxy = association<ArPost>(blog, "arPosts");
    const post = await proxy.where({ published: true }).create({ title: "Hello" });
    expect(post.ar_blog_id).toBe(blog.id);
    expect(post.title).toBe("Hello");
    expect(post.published).toBe(true);
    expect(post.isPersisted()).toBe(true);
  });

  it("build on an association relation sets the FK without saving", async () => {
    const blog = await freshBlog();
    const proxy = association<ArPost>(blog, "arPosts");
    const post = proxy.where({ published: true }).build({ title: "Draft" });
    expect(post.ar_blog_id).toBe(blog.id);
    expect(post.title).toBe("Draft");
    expect(post.published).toBe(true);
    expect(post.isNewRecord()).toBe(true);
  });

  it("pushes built records onto the loaded target", async () => {
    const blog = await freshBlog();
    const proxy = association<ArPost>(blog, "arPosts");
    proxy.where({ published: true }).build({ title: "x" });
    expect(proxy.target.length).toBe(1);
    expect(proxy.target[0].title).toBe("x");
  });

  it("propagates the association reference through long chains", async () => {
    const blog = await freshBlog();
    const proxy = association<ArPost>(blog, "arPosts");
    const deep = proxy.where({ published: true }).order("title").limit(10).offset(0);
    const post = await deep.create({ title: "Chained" });
    expect(post.ar_blog_id).toBe(blog.id);
    expect(post.published).toBe(true);
  });
});
