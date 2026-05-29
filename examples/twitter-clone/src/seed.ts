/**
 * Seed a database with a few users, tweets, and follows.
 * Run against a persistent DB so the server can serve it:
 *
 *   DATABASE_URL=sqlite3:twitter.db pnpm seed
 *   DATABASE_URL=sqlite3:twitter.db pnpm start
 */
import { connectAndMigrate, type DbConfig } from "./db.js";
import { User, Follow } from "./models/index.js";

async function main() {
  const url = process.env.DATABASE_URL as DbConfig | undefined;
  await connectAndMigrate(url);

  const users = await Promise.all([
    User.createBang({ handle: "ada", display_name: "Ada Lovelace", bio: "first programmer" }),
    User.createBang({ handle: "grace", display_name: "Grace Hopper", bio: "compiler pioneer" }),
    User.createBang({ handle: "alan", display_name: "Alan Turing" }),
  ]);
  const [ada, grace, alan] = users;

  await ada.tweets.createBang({ body: "writing notes on the Analytical Engine ✍️" });
  await grace.tweets.createBang({ body: "found a literal bug in the relay 🦟" });
  await alan.tweets.createBang({ body: "can machines think? 🤔" });

  await Follow.createBang({ follower_id: ada.id, followee_id: grace.id });
  await Follow.createBang({ follower_id: ada.id, followee_id: alan.id });
  await Follow.createBang({ follower_id: grace.id, followee_id: ada.id });

  console.log(`Seeded ${await User.count()} users, ${await Follow.count()} follows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
