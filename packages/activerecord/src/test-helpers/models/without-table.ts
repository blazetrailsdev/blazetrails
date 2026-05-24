// vendor/rails/activerecord/test/models/without_table.rb
import { Base } from "../../base.js";

export class WithoutTable extends Base {
  static {
    this.defaultScope(() => this.where({ published: true }));
  }
}
