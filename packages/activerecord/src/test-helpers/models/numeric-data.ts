// vendor/rails/activerecord/test/models/numeric_data.rb
import { Base } from "../../base.js";

export class NumericData extends Base {
  static _tableName = "numeric_data";

  static {
    this.attribute("world_population", "bigInteger");
    this.attribute("my_house_population", "bigInteger");
    this.attribute("atoms_in_universe", "bigInteger");
    this.aliasAttribute("newBankBalance", "bank_balance");
  }
}
