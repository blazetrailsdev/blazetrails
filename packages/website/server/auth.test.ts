import { describe, it, expect, beforeEach, vi } from "vitest";
import { createDatabase } from "./db.js";
import { requestMagicLink, verifyMagicLink, validateSession, invalidateSession } from "./auth.js";
import type { SQLite3Adapter } from "@blazetrails/activerecord";

let db: SQLite3Adapter;
const mockSendEmail = vi.fn(async () => {});

beforeEach(() => {
  db = createDatabase(":memory:");
  mockSendEmail.mockClear();
});

describe("requestMagicLink", () => {
  it("creates a user and sends an email", async () => {
    const token = await requestMagicLink(
      db,
      "alice@example.com",
      mockSendEmail,
      "http://localhost",
    );
    expect(token).toHaveLength(64); // 32 bytes hex
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail.mock.calls[0][0]).toBe("alice@example.com");
    expect(mockSendEmail.mock.calls[0][2]).toContain(token);
  });

  it("normalizes email to lowercase", async () => {
    await requestMagicLink(db, "  Alice@Example.COM  ", mockSendEmail, "http://localhost");
    const users = await db.execute('SELECT "email" FROM "users"');
    expect(users[0].email).toBe("alice@example.com");
  });

  it("reuses existing user on second request", async () => {
    await requestMagicLink(db, "alice@example.com", mockSendEmail, "http://localhost");
    // Bypass rate limit by clearing recent magic links
    await db.executeMutation('DELETE FROM "magic_links"');
    await requestMagicLink(db, "alice@example.com", mockSendEmail, "http://localhost");
    const users = await db.execute('SELECT * FROM "users"');
    expect(users).toHaveLength(1);
  });

  it("throws on invalid email", async () => {
    await expect(requestMagicLink(db, "", mockSendEmail, "http://localhost")).rejects.toThrow(
      "Invalid email",
    );
    await expect(
      requestMagicLink(db, "noatsign", mockSendEmail, "http://localhost"),
    ).rejects.toThrow("Invalid email");
  });

  it("rate limits to 1 per minute per email", async () => {
    await requestMagicLink(db, "alice@example.com", mockSendEmail, "http://localhost");
    await expect(
      requestMagicLink(db, "alice@example.com", mockSendEmail, "http://localhost"),
    ).rejects.toThrow("Please wait a minute");
  });

  it("allows different emails simultaneously", async () => {
    await requestMagicLink(db, "alice@example.com", mockSendEmail, "http://localhost");
    await expect(
      requestMagicLink(db, "bob@example.com", mockSendEmail, "http://localhost"),
    ).resolves.toBeTruthy();
  });
});

describe("verifyMagicLink", () => {
  it("returns session token for valid link", async () => {
    const token = await requestMagicLink(
      db,
      "alice@example.com",
      mockSendEmail,
      "http://localhost",
    );
    const result = await verifyMagicLink(db, token);
    expect(result).not.toBeNull();
    expect(result!.email).toBe("alice@example.com");
    expect(result!.sessionToken).toHaveLength(64);
  });

  it("marks user as verified", async () => {
    const token = await requestMagicLink(
      db,
      "alice@example.com",
      mockSendEmail,
      "http://localhost",
    );
    await verifyMagicLink(db, token);
    const users = await db.execute('SELECT "verified" FROM "users" WHERE "email" = ?', [
      "alice@example.com",
    ]);
    expect(users[0].verified).toBe(1);
  });

  it("rejects already-used token", async () => {
    const token = await requestMagicLink(
      db,
      "alice@example.com",
      mockSendEmail,
      "http://localhost",
    );
    await verifyMagicLink(db, token);
    const result = await verifyMagicLink(db, token);
    expect(result).toBeNull();
  });

  it("rejects expired token", async () => {
    const token = await requestMagicLink(
      db,
      "alice@example.com",
      mockSendEmail,
      "http://localhost",
    );
    // Expire the token manually
    const pastDate = new Date(Date.now() - 3600_000).toISOString();
    await db.executeMutation('UPDATE "magic_links" SET "expires_at" = ? WHERE "token" = ?', [
      pastDate,
      token,
    ]);
    const result = await verifyMagicLink(db, token);
    expect(result).toBeNull();
  });

  it("rejects unknown token", async () => {
    const result = await verifyMagicLink(db, "nonexistent");
    expect(result).toBeNull();
  });
});

describe("validateSession", () => {
  async function loginAs(email: string): Promise<string> {
    const token = await requestMagicLink(db, email, mockSendEmail, "http://localhost");
    const result = await verifyMagicLink(db, token);
    return result!.sessionToken;
  }

  it("returns user for valid session", async () => {
    const sessionToken = await loginAs("alice@example.com");
    const user = await validateSession(db, sessionToken);
    expect(user).not.toBeNull();
    expect(user!.email).toBe("alice@example.com");
    expect(user!.userId).toBeTruthy();
  });

  it("rejects expired session", async () => {
    const sessionToken = await loginAs("alice@example.com");
    await db.executeMutation(
      'UPDATE "sessions" SET "expires_at" = datetime(\'now\', \'-1 day\') WHERE "token" = ?',
      [sessionToken],
    );
    const user = await validateSession(db, sessionToken);
    expect(user).toBeNull();
  });

  it("rejects unknown session", async () => {
    const user = await validateSession(db, "bogus");
    expect(user).toBeNull();
  });
});

describe("invalidateSession", () => {
  it("logs out the user", async () => {
    const token = await requestMagicLink(
      db,
      "alice@example.com",
      mockSendEmail,
      "http://localhost",
    );
    const { sessionToken } = (await verifyMagicLink(db, token))!;

    await invalidateSession(db, sessionToken);
    const user = await validateSession(db, sessionToken);
    expect(user).toBeNull();
  });
});
