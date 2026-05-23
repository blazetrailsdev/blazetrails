// vendor/rails/activerecord/test/models/admin/account.rb
import { Base } from "../../../base.js";

export class AdminAccount extends Base {
  static _tableName = "accounts";

  static {
    this.hasMany("users", { className: "AdminUser" });
  }
}
