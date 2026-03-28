/**
 * Frontiers API Server
 * Run with: pnpm --filter @blazetrails/website server
 */

import { createServer } from "http";
import { createDatabase } from "./db.js";
import { createHandler } from "./handler.js";

const PORT = parseInt(process.env.PORT ?? "3100", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const DB_PATH = process.env.DB_PATH ?? "frontiers-api.sqlite3";
const BASE_URL =
  process.env.BASE_URL ?? `http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`;

const db = createDatabase(DB_PATH);

const handler = createHandler({
  db,
  baseUrl: BASE_URL,
  async sendEmail(to, subject, body) {
    // TODO: plug in Resend/Postmark/SMTP
    console.log(`[email] To: ${to}\n  Subject: ${subject}\n  ${body}\n`);
  },
});

const server = createServer(handler);

server.listen(PORT, HOST, () => {
  console.log(`Frontiers API listening on http://${HOST}:${PORT}`);
});
