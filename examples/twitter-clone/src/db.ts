import { Base, Schema } from "@blazetrails/activerecord";
import { User, Tweet, Follow, Like } from "./models/index.js";

/**
 * Connect ActiveRecord to a database and create the schema.
 *
 * In a real Rails app this lives in `config/database.yml` +
 * `db/schema.rb` (generated from migrations). Here we keep it in one
 * place: open a connection, then declare the tables with the same
 * `create_table` DSL Rails migrations use.
 *
 * Defaults to an in-memory SQLite database so the example is zero-setup
 * (pool size 1 — a shared :memory: db can't be reopened across pool
 * connections). Pass a config to point at a file or another adapter, e.g.
 * `{ adapter: "sqlite3", database: "twitter.db" }` or
 * `{ adapter: "postgresql", url: "postgres://localhost/twitter" }`.
 */
export type DbConfig =
  | string
  | { adapter?: string; url?: string; database?: string; [k: string]: unknown };

const IN_MEMORY: DbConfig = { adapter: "sqlite3", database: ":memory:", pool: 1 };

export async function connectAndMigrate(config: DbConfig = IN_MEMORY): Promise<void> {
  await Base.establishConnection(config);

  await Schema.define(Base.connection, async (schema) => {
    await schema.createTable("users", (t) => {
      t.string("handle");
      t.string("display_name");
      t.string("bio");
      t.timestamps();
    });

    await schema.createTable("tweets", (t) => {
      t.integer("user_id");
      t.text("body");
      t.timestamps();
    });

    await schema.createTable("follows", (t) => {
      // follower_id follows followee_id
      t.integer("follower_id");
      t.integer("followee_id");
      t.timestamps();
    });

    await schema.createTable("likes", (t) => {
      t.integer("user_id");
      t.integer("tweet_id");
      t.timestamps();
    });
  });

  // The models declare no attributes — reflect their columns from the DB
  // schema now so reads/writes and auto-timestamps work. (Rails does this
  // lazily on first use; we warm it eagerly so the first request is ready.)
  await Promise.all([User, Tweet, Follow, Like].map((m) => m.loadSchema()));
}
