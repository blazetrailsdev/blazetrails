import { connectAndMigrate } from "./db.js";
import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3000);
// Set DATABASE_URL to persist (e.g. sqlite3:twitter.db or a postgres:// URL).
// Default is in-memory SQLite — a clean slate on every boot.
const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  await connectAndMigrate(DATABASE_URL ?? undefined);
  const app = buildApp();
  app.listen(PORT, () => {
    console.log(`Twitter clone listening on http://localhost:${PORT}`);
    console.log(`  DB: ${DATABASE_URL ?? "in-memory sqlite"}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
