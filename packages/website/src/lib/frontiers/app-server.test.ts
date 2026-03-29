import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("sql.js", async () => {
  const actual = await vi.importActual<typeof import("sql.js")>("sql.js");
  return { default: () => actual.default() };
});

import { createRuntime, type Runtime } from "./runtime.js";

let runtime: Runtime;

beforeEach(async () => {
  runtime = await createRuntime();
  for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
  runtime.clearMigrations();
});

describe("AppServer", () => {
  it("has an app server on the runtime", () => {
    expect(runtime.app).toBeTruthy();
    expect(runtime.app.call).toBeTypeOf("function");
    expect(runtime.app.registerController).toBeTypeOf("function");
    expect(runtime.app.drawRoutes).toBeTypeOf("function");
  });

  it("returns 404 for unmatched routes", async () => {
    const res = await runtime.app.call("GET", "/nothing");
    expect(res.status).toBe(404);
  });

  it("routes to a registered controller", async () => {
    // Register a controller via user code
    await runtime.executeCode(`
      class HelloController extends ActionController.Base {
        async index() {
          this.render({ json: { message: "hello world" } });
        }
      }
      app.registerController("hello", HelloController);
      app.drawRoutes((r) => {
        r.get("/hello", { to: "hello#index" });
      });
    `);

    const res = await runtime.app.call("GET", "/hello");
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe("hello world");
  });

  it("passes route params to the controller", async () => {
    await runtime.executeCode(`
      class UsersController extends ActionController.Base {
        async show() {
          const id = this.params.get("id");
          this.render({ json: { id } });
        }
      }
      app.registerController("users", UsersController);
      app.drawRoutes((r) => {
        r.get("/users/:id", { to: "users#show" });
      });
    `);

    const res = await runtime.app.call("GET", "/users/42");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).id).toBe("42");
  });

  it("request() shorthand works", async () => {
    await runtime.executeCode(`
      class PingController extends ActionController.Base {
        async index() {
          this.render({ plain: "pong" });
        }
      }
      app.registerController("ping", PingController);
      app.drawRoutes((r) => {
        r.get("/ping", { to: "ping#index" });
      });
    `);

    const res = await runtime.request("GET", "/ping");
    expect(res.status).toBe(200);
    expect(res.body).toBe("pong");
  });

  it("handles controller errors gracefully", async () => {
    await runtime.executeCode(`
      class BrokenController extends ActionController.Base {
        async index() {
          throw new Error("something broke");
        }
      }
      app.registerController("broken", BrokenController);
      app.drawRoutes((r) => {
        r.get("/broken", { to: "broken#index" });
      });
    `);

    const res = await runtime.app.call("GET", "/broken");
    expect(res.status).toBe(500);
    expect(res.body).toContain("something broke");
  });

  it("supports JSON rendering", async () => {
    await runtime.executeCode(`
      class ApiController extends ActionController.Base {
        async index() {
          this.render({ json: [1, 2, 3], status: "ok" });
        }
      }
      app.registerController("api", ApiController);
      app.drawRoutes((r) => {
        r.get("/api", { to: "api#index" });
      });
    `);

    const res = await runtime.app.call("GET", "/api");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual([1, 2, 3]);
  });
});

describe("Full scaffold + serve workflow", () => {
  it("scaffold -> migrate -> server -> request", async () => {
    // Step 1: Create app and scaffold
    await runtime.exec("new my-api");
    await runtime.exec("scaffold Post title:string body:text");
    await runtime.exec("db:migrate");

    // Step 2: Seed data
    await runtime.adapter.executeMutation(
      'INSERT INTO "posts" ("title", "body", "created_at", "updated_at") VALUES (?, ?, datetime("now"), datetime("now"))',
      ["Hello World", "First post!"],
    );

    // Step 3: Load the server (routes + controllers)
    await runtime.exec("server");

    // Step 4: Make a request
    const res = await runtime.request("GET", "/posts");
    expect(res.status).toBe(200);
    const posts = JSON.parse(res.body);
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Hello World");
  });

  it("show route returns a single record", async () => {
    await runtime.exec("new my-api");
    await runtime.exec("scaffold Item name:string price:decimal");
    await runtime.exec("db:migrate");
    await runtime.adapter.executeMutation(
      'INSERT INTO "items" ("name", "price", "created_at", "updated_at") VALUES (?, ?, datetime("now"), datetime("now"))',
      ["Widget", 9.99],
    );
    await runtime.exec("server");

    const res = await runtime.request("GET", "/items/1");
    expect(res.status).toBe(200);
    const item = JSON.parse(res.body);
    expect(item.name).toBe("Widget");
    expect(item.price).toBe(9.99);
  });

  it("show returns 404 for missing record", async () => {
    await runtime.exec("new my-api");
    await runtime.exec("scaffold Thing name:string");
    await runtime.exec("db:migrate");
    await runtime.exec("server");

    const res = await runtime.request("GET", "/things/999");
    expect(res.status).toBe(404);
  });

  it("routes command shows registered routes", async () => {
    await runtime.exec("new my-api");
    await runtime.exec("scaffold Post title:string");
    await runtime.exec("server");

    const result = await runtime.exec("routes");
    expect(result.success).toBe(true);
    expect(result.output.some((l) => l.includes("/posts") && l.includes("index"))).toBe(true);
  });
});
