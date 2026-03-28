import type { IncomingMessage, ServerResponse } from "http";
import type { SQLite3Adapter } from "@blazetrails/activerecord";
import { randomBytes } from "crypto";
import {
  requestMagicLink,
  verifyMagicLink,
  validateSession,
  invalidateSession,
  type SendEmailFn,
} from "./auth.js";

const MAX_SIZE = 10 * 1024 * 1024;

function generateId(): string {
  return randomBytes(8).toString("hex");
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_SIZE) throw new Error("Payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

export interface HandlerOptions {
  db: SQLite3Adapter;
  sendEmail: SendEmailFn;
  baseUrl: string;
}

export function createHandler({ db, sendEmail, baseUrl }: HandlerOptions) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type, x-project-name, authorization");
    res.setHeader("access-control-expose-headers", "x-project-name");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", baseUrl);

    // Extract session from Authorization header
    async function getUser() {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return null;
      return validateSession(db, authHeader.slice(7));
    }

    // Require auth — returns user or sends 401
    async function requireUser() {
      const user = await getUser();
      if (!user) {
        json(res, 401, {
          error: "Authentication required. Verified email needed to save projects.",
        });
        return null;
      }
      return user;
    }

    try {
      // --- Auth routes (no auth required) ---

      // POST /api/auth/login — request magic link
      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        const body = JSON.parse((await readBody(req)).toString());
        const email = body.email;
        if (!email) {
          json(res, 400, { error: "Email is required" });
          return;
        }
        await requestMagicLink(db, email, sendEmail, baseUrl);
        json(res, 200, { message: "Magic link sent. Check your email." });
        return;
      }

      // GET /api/auth/verify?token=... — verify magic link
      if (req.method === "GET" && url.pathname === "/api/auth/verify") {
        const token = url.searchParams.get("token");
        if (!token) {
          json(res, 400, { error: "Token is required" });
          return;
        }
        const result = await verifyMagicLink(db, token);
        if (!result) {
          json(res, 401, { error: "Invalid or expired link" });
          return;
        }
        // If redirect param is set, redirect to frontend with session in URL
        const redirect = url.searchParams.get("redirect");
        if (redirect) {
          const target = new URL(redirect, baseUrl);
          target.searchParams.set("session", result.sessionToken);
          res.writeHead(302, { Location: target.toString() });
          res.end();
          return;
        }
        json(res, 200, { sessionToken: result.sessionToken, email: result.email });
        return;
      }

      // GET /api/auth/me — get current user
      if (req.method === "GET" && url.pathname === "/api/auth/me") {
        const user = await getUser();
        if (!user) {
          json(res, 401, { error: "Not authenticated" });
          return;
        }
        json(res, 200, { userId: user.userId, email: user.email });
        return;
      }

      // POST /api/auth/logout — invalidate session
      if (req.method === "POST" && url.pathname === "/api/auth/logout") {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          await invalidateSession(db, authHeader.slice(7));
        }
        json(res, 200, { message: "Logged out" });
        return;
      }

      // --- Project routes ---

      // POST /api/projects — create project (auth required)
      if (req.method === "POST" && url.pathname === "/api/projects") {
        const user = await requireUser();
        if (!user) return;

        const body = await readBody(req);
        const name = (req.headers["x-project-name"] as string) ?? "untitled";
        const id = generateId();

        await db.executeMutation(
          `INSERT INTO "projects" ("id", "user_id", "name", "data", "size") VALUES (?, ?, ?, ?, ?)`,
          [id, user.userId, name, body, body.length],
        );

        json(res, 201, { id, name, size: body.length });
        return;
      }

      // PUT /api/projects/:id — update project (auth required, must be owner)
      if (req.method === "PUT" && url.pathname.match(/^\/api\/projects\/[a-f0-9]+$/)) {
        const user = await requireUser();
        if (!user) return;

        const id = url.pathname.split("/").pop()!;
        const existing = await db.execute(`SELECT "user_id" FROM "projects" WHERE "id" = ?`, [id]);

        if (existing.length === 0) {
          json(res, 404, { error: "Not found" });
          return;
        }
        if (existing[0].user_id !== user.userId) {
          json(res, 403, { error: "Not your project" });
          return;
        }

        const body = await readBody(req);
        const name = req.headers["x-project-name"] as string | undefined;

        if (name) {
          await db.executeMutation(
            `UPDATE "projects" SET "data" = ?, "size" = ?, "name" = ?, "updated_at" = datetime('now') WHERE "id" = ?`,
            [body, body.length, name, id],
          );
        } else {
          await db.executeMutation(
            `UPDATE "projects" SET "data" = ?, "size" = ?, "updated_at" = datetime('now') WHERE "id" = ?`,
            [body, body.length, id],
          );
        }

        json(res, 200, { id, size: body.length });
        return;
      }

      // GET /api/projects/:id — load project (public, no auth required)
      if (req.method === "GET" && url.pathname.match(/^\/api\/projects\/[a-f0-9]+$/)) {
        const id = url.pathname.split("/").pop()!;
        const rows = await db.execute(
          `SELECT "name", "data", "public", "user_id" FROM "projects" WHERE "id" = ?`,
          [id],
        );

        if (rows.length === 0) {
          json(res, 404, { error: "Not found" });
          return;
        }

        const row = rows[0];
        // Private projects require auth
        if (!row.public) {
          const user = await getUser();
          if (!user || user.userId !== row.user_id) {
            json(res, 404, { error: "Not found" });
            return;
          }
        }

        res.writeHead(200, {
          "content-type": "application/octet-stream",
          "x-project-name": String(row.name),
        });
        res.end(row.data as Buffer);
        return;
      }

      // GET /api/projects — list public projects (no auth required)
      if (req.method === "GET" && url.pathname === "/api/projects") {
        const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
        const user = await getUser();

        let rows;
        if (user) {
          // Authenticated: show own projects + public projects
          rows = await db.execute(
            `SELECT "id", "name", "size", "user_id", "public", "created_at", "updated_at"
             FROM "projects"
             WHERE "public" = 1 OR "user_id" = ?
             ORDER BY "updated_at" DESC LIMIT ?`,
            [user.userId, limit],
          );
        } else {
          rows = await db.execute(
            `SELECT "id", "name", "size", "public", "created_at", "updated_at"
             FROM "projects"
             WHERE "public" = 1
             ORDER BY "updated_at" DESC LIMIT ?`,
            [limit],
          );
        }

        json(res, 200, rows);
        return;
      }

      // DELETE /api/projects/:id — delete project (auth required, must be owner)
      if (req.method === "DELETE" && url.pathname.match(/^\/api\/projects\/[a-f0-9]+$/)) {
        const user = await requireUser();
        if (!user) return;

        const id = url.pathname.split("/").pop()!;
        const existing = await db.execute(`SELECT "user_id" FROM "projects" WHERE "id" = ?`, [id]);

        if (existing.length === 0) {
          json(res, 404, { error: "Not found" });
          return;
        }
        if (existing[0].user_id !== user.userId) {
          json(res, 403, { error: "Not your project" });
          return;
        }

        await db.executeMutation(`DELETE FROM "projects" WHERE "id" = ?`, [id]);
        res.writeHead(204);
        res.end();
        return;
      }

      json(res, 404, { error: "Not found" });
    } catch (e: any) {
      const status = e.message === "Payload too large" ? 413 : 500;
      json(res, status, { error: e.message });
    }
  };
}
