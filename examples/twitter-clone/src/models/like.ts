import { Base } from "@blazetrails/activerecord";

export class Like extends Base {
  static {
    this.belongsTo("user");
    this.belongsTo("tweet");

    // A user can like a given tweet at most once.
    this.validatesUniqueness("user_id", { scope: "tweet_id" });
  }
}
