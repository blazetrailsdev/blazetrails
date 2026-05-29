import { Migration } from "@blazetrails/activerecord";

export default class CreateUsers extends Migration {
  async change() {
    await this.createTable("users", (t) => {
      t.string("handle");
      t.string("display_name");
      t.string("bio");
      t.timestamps();
    });
  }
}
