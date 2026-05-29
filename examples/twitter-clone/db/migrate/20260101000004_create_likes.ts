import { Migration } from "@blazetrails/activerecord";

export default class CreateLikes extends Migration {
  async change() {
    await this.createTable("likes", (t) => {
      t.integer("user_id");
      t.integer("tweet_id");
      t.timestamps();
    });
  }
}
