import { SQLite3Adapter } from "@blazetrails/activerecord";

export function createDatabase(path: string): SQLite3Adapter {
  const db = new SQLite3Adapter(path);
  migrate(db);
  return db;
}

function migrate(db: SQLite3Adapter) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "verified" INTEGER NOT NULL DEFAULT 0,
      "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
      "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS "magic_links" (
      "token" TEXT PRIMARY KEY NOT NULL,
      "email" TEXT NOT NULL,
      "expires_at" TEXT NOT NULL,
      "used" INTEGER NOT NULL DEFAULT 0,
      "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "token" TEXT PRIMARY KEY NOT NULL,
      "user_id" TEXT NOT NULL REFERENCES "users"("id"),
      "expires_at" TEXT NOT NULL,
      "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS "projects" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "user_id" TEXT NOT NULL REFERENCES "users"("id"),
      "name" TEXT NOT NULL DEFAULT 'untitled',
      "data" BLOB NOT NULL,
      "size" INTEGER NOT NULL DEFAULT 0,
      "public" INTEGER NOT NULL DEFAULT 1,
      "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
      "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS "idx_projects_user_id" ON "projects" ("user_id")`);
  db.exec(`CREATE INDEX IF NOT EXISTS "idx_projects_updated_at" ON "projects" ("updated_at" DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" ("user_id")`);
  db.exec(`CREATE INDEX IF NOT EXISTS "idx_magic_links_email" ON "magic_links" ("email")`);
}
