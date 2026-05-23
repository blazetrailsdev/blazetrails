// vendor/rails/activerecord/test/models/post_with_prefetched_pk.rb
import { Base } from "../../base.js";

export class PostWithPrefetchedPk extends (Base as any) {
  static _tableName = "posts";

  static prefetchPrimaryKey = true;

  static nextSequenceValue() {
    return 123456;
  }
}
