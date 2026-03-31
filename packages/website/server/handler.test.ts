import { describe, it, expect, beforeEach, vi } from "vitest";
import { createServer, type Server } from "http";
import { createDatabase } from "./db.js";
import { createHandler } from "./handler.js";
import { requestMagicLink, verifyMagicLink } from "./auth.js";
import type { SQLite3Adapter } from "@blazetrails/activerecord";

let db: SQLite3Adapter;
let server: Server;
let baseUrl: string;
const mockSendEmail = vi.fn(async () => {});

async function startServer() {
  db = createDatabase(":memory:");
  const handler = createHandler({ db, sendEmail: mockSendEmail, baseUrl: "http://localhost" });
  server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
}

async function stopServer() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function loginAs(email: string): Promise<string> {
  const token = await requestMagicLink(db, email, mockSendEmail, "http://localhost");
  const result = await verifyMagicLink(db, token);
  return result!.sessionToken;
}

function authHeaders(sessionToken: string) {
  return { Authorization: `Bearer ${sessionToken}` };
}

beforeEach(async () => {
  mockSendEmail.mockClear();
  await startServer();
  return () => stopServer();
});

describe("Auth endpoints", () => {
  it("POST /api/auth/login sends magic link", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("Magic link sent");
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("POST /api/auth/login rejects missing email", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/auth/verify validates token and returns session", async () => {
    const token = await requestMagicLink(
      db,
      "alice@example.com",
      mockSendEmail,
      "http://localhost",
    );
    const res = await fetch(`${baseUrl}/api/auth/verify?token=${token}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessionToken).toBeTruthy();
    expect(data.email).toBe("alice@example.com");
  });

  it("GET /api/auth/verify rejects invalid token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify?token=bogus`);
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/verify redirects when redirect param is set", async () => {
    const token = await requestMagicLink(
      db,
      "alice@example.com",
      mockSendEmail,
      "http://localhost",
    );
    const res = await fetch(`${baseUrl}/api/auth/verify?token=${token}&redirect=/frontiers`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("/frontiers");
    expect(location).toContain("session=");
  });

  it("POST /api/auth/login rate limits", async () => {
    await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "rate@example.com" }),
    });
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "rate@example.com" }),
    });
    expect(res.status).toBe(500); // rate limit throws
    const data = await res.json();
    expect(data.error).toContain("wait a minute");
  });

  it("GET /api/auth/me returns user info", async () => {
    const sessionToken = await loginAs("alice@example.com");
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: authHeaders(sessionToken),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe("alice@example.com");
  });

  it("GET /api/auth/me rejects unauthenticated", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/logout invalidates session", async () => {
    const sessionToken = await loginAs("alice@example.com");
    await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: authHeaders(sessionToken),
    });
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: authHeaders(sessionToken),
    });
    expect(res.status).toBe(401);
  });
});

describe("Project endpoints", () => {
  describe("unauthenticated", () => {
    it("POST /api/projects returns 401", async () => {
      const res = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        body: Buffer.from("data"),
      });
      expect(res.status).toBe(401);
    });

    it("GET /api/projects/:id returns public projects", async () => {
      // Create a project as authenticated user
      const sessionToken = await loginAs("alice@example.com");
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: { ...authHeaders(sessionToken), "x-project-name": "test" },
        body: Buffer.from("project-data"),
      });
      const { id } = await createRes.json();

      // Read without auth — should work (projects are public by default)
      const res = await fetch(`${baseUrl}/api/projects/${id}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-project-name")).toBe("test");
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.toString()).toBe("project-data");
    });

    it("GET /api/projects lists public projects", async () => {
      const sessionToken = await loginAs("alice@example.com");
      await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: { ...authHeaders(sessionToken), "x-project-name": "pub" },
        body: Buffer.from("data"),
      });

      const res = await fetch(`${baseUrl}/api/projects`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("pub");
    });

    it("PUT /api/projects/:id returns 401", async () => {
      const sessionToken = await loginAs("alice@example.com");
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: authHeaders(sessionToken),
        body: Buffer.from("data"),
      });
      const { id } = await createRes.json();

      const res = await fetch(`${baseUrl}/api/projects/${id}`, {
        method: "PUT",
        body: Buffer.from("new-data"),
      });
      expect(res.status).toBe(401);
    });

    it("DELETE /api/projects/:id returns 401", async () => {
      const sessionToken = await loginAs("alice@example.com");
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: authHeaders(sessionToken),
        body: Buffer.from("data"),
      });
      const { id } = await createRes.json();

      const res = await fetch(`${baseUrl}/api/projects/${id}`, { method: "DELETE" });
      expect(res.status).toBe(401);
    });
  });

  describe("authenticated", () => {
    let sessionToken: string;

    beforeEach(async () => {
      sessionToken = await loginAs("alice@example.com");
    });

    it("creates and retrieves a project", async () => {
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: { ...authHeaders(sessionToken), "x-project-name": "my-app" },
        body: Buffer.from("hello-data"),
      });
      expect(createRes.status).toBe(201);
      const { id } = await createRes.json();
      expect(id).toBeTruthy();

      const getRes = await fetch(`${baseUrl}/api/projects/${id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.headers.get("x-project-name")).toBe("my-app");
    });

    it("updates own project", async () => {
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: { ...authHeaders(sessionToken), "x-project-name": "v1" },
        body: Buffer.from("original"),
      });
      const { id } = await createRes.json();

      const updateRes = await fetch(`${baseUrl}/api/projects/${id}`, {
        method: "PUT",
        headers: { ...authHeaders(sessionToken), "x-project-name": "v2" },
        body: Buffer.from("updated"),
      });
      expect(updateRes.status).toBe(200);

      const getRes = await fetch(`${baseUrl}/api/projects/${id}`);
      expect(getRes.headers.get("x-project-name")).toBe("v2");
      const body = Buffer.from(await getRes.arrayBuffer());
      expect(body.toString()).toBe("updated");
    });

    it("cannot update another user's project", async () => {
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: authHeaders(sessionToken),
        body: Buffer.from("data"),
      });
      const { id } = await createRes.json();

      const bobToken = await loginAs("bob@example.com");
      const updateRes = await fetch(`${baseUrl}/api/projects/${id}`, {
        method: "PUT",
        headers: authHeaders(bobToken),
        body: Buffer.from("hacked"),
      });
      expect(updateRes.status).toBe(403);
    });

    it("deletes own project", async () => {
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: authHeaders(sessionToken),
        body: Buffer.from("data"),
      });
      const { id } = await createRes.json();

      const deleteRes = await fetch(`${baseUrl}/api/projects/${id}`, {
        method: "DELETE",
        headers: authHeaders(sessionToken),
      });
      expect(deleteRes.status).toBe(204);

      const getRes = await fetch(`${baseUrl}/api/projects/${id}`);
      expect(getRes.status).toBe(404);
    });

    it("cannot delete another user's project", async () => {
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: authHeaders(sessionToken),
        body: Buffer.from("data"),
      });
      const { id } = await createRes.json();

      const bobToken = await loginAs("bob@example.com");
      const deleteRes = await fetch(`${baseUrl}/api/projects/${id}`, {
        method: "DELETE",
        headers: authHeaders(bobToken),
      });
      expect(deleteRes.status).toBe(403);
    });

    it("GET /api/projects/:id returns 404 for nonexistent", async () => {
      const res = await fetch(`${baseUrl}/api/projects/0000000000000000`);
      expect(res.status).toBe(404);
    });
  });
});

describe("CORS", () => {
  it("responds to OPTIONS with CORS headers", async () => {
    const res = await fetch(`${baseUrl}/api/projects`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-headers")).toContain("authorization");
  });
});

describe("Edge cases", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/api/unknown`);
    expect(res.status).toBe(404);
  });

  it("POST /api/auth/login with invalid JSON returns 500", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json{{{",
    });
    expect(res.status).toBe(500);
  });

  it("GET /api/auth/verify without token returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`);
    expect(res.status).toBe(400);
  });

  it("authenticated user sees own private projects in list", async () => {
    const sessionToken = await loginAs("alice@example.com");
    // Create a project (default public=1)
    await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { ...authHeaders(sessionToken), "x-project-name": "mine" },
      body: Buffer.from("data"),
    });

    const res = await fetch(`${baseUrl}/api/projects`, {
      headers: authHeaders(sessionToken),
    });
    const data = await res.json();
    expect(data.some((p: any) => p.name === "mine")).toBe(true);
  });

  it("project name defaults to untitled", async () => {
    const sessionToken = await loginAs("alice@example.com");
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: authHeaders(sessionToken),
      body: Buffer.from("data"),
    });
    const { id } = await res.json();

    const getRes = await fetch(`${baseUrl}/api/projects/${id}`);
    expect(getRes.headers.get("x-project-name")).toBe("untitled");
  });

  it("PUT without name preserves existing name", async () => {
    const sessionToken = await loginAs("alice@example.com");
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { ...authHeaders(sessionToken), "x-project-name": "original" },
      body: Buffer.from("v1"),
    });
    const { id } = await createRes.json();

    // Update without x-project-name
    await fetch(`${baseUrl}/api/projects/${id}`, {
      method: "PUT",
      headers: authHeaders(sessionToken),
      body: Buffer.from("v2"),
    });

    const getRes = await fetch(`${baseUrl}/api/projects/${id}`);
    expect(getRes.headers.get("x-project-name")).toBe("original");
  });

  it("PUT to nonexistent project returns 404", async () => {
    const sessionToken = await loginAs("alice@example.com");
    const res = await fetch(`${baseUrl}/api/projects/0000000000000000`, {
      method: "PUT",
      headers: authHeaders(sessionToken),
      body: Buffer.from("data"),
    });
    expect(res.status).toBe(404);
  });

  it("DELETE nonexistent project returns 404", async () => {
    const sessionToken = await loginAs("alice@example.com");
    const res = await fetch(`${baseUrl}/api/projects/0000000000000000`, {
      method: "DELETE",
      headers: authHeaders(sessionToken),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/projects respects limit parameter", async () => {
    const sessionToken = await loginAs("alice@example.com");
    for (let i = 0; i < 3; i++) {
      await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: { ...authHeaders(sessionToken), "x-project-name": `p${i}` },
        body: Buffer.from("d"),
      });
    }

    const res = await fetch(`${baseUrl}/api/projects?limit=2`);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });
});
