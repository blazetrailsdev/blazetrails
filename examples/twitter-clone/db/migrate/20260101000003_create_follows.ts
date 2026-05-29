import { Migration } from "@blazetrails/activerecord";

export default class CreateFollows extends Migration {
  async change() {
    // follower_id follows followee_id
    await this.createTable("follows", (t) => {
      t.integer("follower_id");
      t.integer("followee_id");
      t.timestamps();
    });
  }
}
