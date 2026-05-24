// vendor/rails/activerecord/test/models/personal_legacy_thing.rb
import { Base } from "../../base.js";

export class PersonalLegacyThing extends Base {
  static lockingColumn = "version";

  static {
    this.belongsTo("person", { counterCache: true });
  }
}
