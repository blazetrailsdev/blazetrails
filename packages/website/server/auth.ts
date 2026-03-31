import { randomBytes } from "crypto";
import type { SQLite3Adapter } from "@blazetrails/activerecord";

const MAGIC_LINK_TTL_MINUTES = 15;
const SESSION_TTL_DAYS = 30;

export interface SendEmailFn {
  (to: string, subject: string, body: string): Promise<void>;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateId(): string {
  return randomBytes(8).toString("hex");
}

function minutesFromNow(n: number): string {
  return new Date(Date.now() + n * 60_000).toISOString();
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}

/**
 * Request a magic link. Creates the user if they don't exist (unverified).
 * Returns the token (for testing) — in production, only send it via email.
 */
export async function requestMagicLink(
  db: SQLite3Adapter,
  email: string,
  sendEmail: SendEmailFn,
  baseUrl: string,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Invalid email");
  }

  // Rate limit: 1 magic link per email per minute
  const recent = await db.execute(
    `SELECT COUNT(*) as c FROM "magic_links" WHERE "email" = ? AND "created_at" > datetime('now', '-1 minute')`,
    [normalized],
  );
  if ((recent[0]?.c as number) > 0) {
    throw new Error("Please wait a minute before requesting another link");
  }

  // Upsert user
  const existing = await db.execute('SELECT "id" FROM "users" WHERE "email" = ?', [normalized]);
  if (existing.length === 0) {
    await db.executeMutation('INSERT INTO "users" ("id", "email") VALUES (?, ?)', [
      generateId(),
      normalized,
    ]);
  }

  // Create magic link token
  const token = generateToken();
  await db.executeMutation(
    'INSERT INTO "magic_links" ("token", "email", "expires_at") VALUES (?, ?, ?)',
    [token, normalized, minutesFromNow(MAGIC_LINK_TTL_MINUTES)],
  );

  const link = `${baseUrl}/api/auth/verify?token=${token}&redirect=/frontiers`;
  await sendEmail(
    normalized,
    "Sign in to BlazeTrails Frontiers",
    `Click to sign in: ${link}\n\nThis link expires in ${MAGIC_LINK_TTL_MINUTES} minutes.`,
  );

  return token;
}

/**
 * Verify a magic link token. Returns a session token on success.
 */
export async function verifyMagicLink(
  db: SQLite3Adapter,
  token: string,
): Promise<{ sessionToken: string; email: string } | null> {
  const rows = await db.execute(
    'SELECT "email", "expires_at", "used" FROM "magic_links" WHERE "token" = ?',
    [token],
  );
  if (rows.length === 0) return null;

  const { email, expires_at, used } = rows[0] as {
    email: string;
    expires_at: string;
    used: number;
  };

  if (used) return null;
  // SQLite datetime may be "YYYY-MM-DD HH:MM:SS" or ISO — handle both
  const expiresMs = new Date(
    expires_at.replace(" ", "T") + (expires_at.includes("Z") ? "" : "Z"),
  ).getTime();
  if (expiresMs < Date.now()) return null;

  // Mark used
  await db.executeMutation('UPDATE "magic_links" SET "used" = 1 WHERE "token" = ?', [token]);

  // Mark user verified
  await db.executeMutation(
    'UPDATE "users" SET "verified" = 1, "updated_at" = datetime(\'now\') WHERE "email" = ?',
    [email],
  );

  // Create session
  const user = await db.execute('SELECT "id" FROM "users" WHERE "email" = ?', [email]);
  const sessionToken = generateToken();
  await db.executeMutation(
    'INSERT INTO "sessions" ("token", "user_id", "expires_at") VALUES (?, ?, ?)',
    [sessionToken, user[0].id as string, daysFromNow(SESSION_TTL_DAYS)],
  );

  return { sessionToken, email };
}

/**
 * Validate a session token. Returns the user ID and email if valid.
 */
export async function validateSession(
  db: SQLite3Adapter,
  sessionToken: string,
): Promise<{ userId: string; email: string } | null> {
  const rows = await db.execute(
    `SELECT s."user_id", s."expires_at", u."email", u."verified"
     FROM "sessions" s JOIN "users" u ON s."user_id" = u."id"
     WHERE s."token" = ?`,
    [sessionToken],
  );
  if (rows.length === 0) return null;

  const { user_id, expires_at, email, verified } = rows[0] as {
    user_id: string;
    expires_at: string;
    email: string;
    verified: number;
  };

  if (!verified) return null;
  const expiresMs = new Date(
    expires_at.replace(" ", "T") + (expires_at.includes("Z") ? "" : "Z"),
  ).getTime();
  if (expiresMs < Date.now()) return null;

  return { userId: user_id, email };
}

/**
 * Invalidate a session token (logout).
 */
export async function invalidateSession(db: SQLite3Adapter, sessionToken: string): Promise<void> {
  await db.executeMutation('DELETE FROM "sessions" WHERE "token" = ?', [sessionToken]);
}
