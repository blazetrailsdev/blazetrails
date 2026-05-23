// vendor/rails/activerecord/test/models/sponsor.rb
import { Base } from "../../base.js";

export class Sponsor extends Base {
  static {
    this.belongsTo("sponsorClub", { className: "Club", foreignKey: "club_id" });
    this.belongsTo("sponsorable", { polymorphic: true });
    this.belongsTo("sponsor", { polymorphic: true });
    this.belongsTo("thing", {
      polymorphic: true,
      // foreign_type: "sponsorable_type" — not yet in AssociationOptions
      foreignKey: "sponsorable_id",
    } as any);
    this.belongsTo("sponsorableWithConditions", {
      scope: (q: any) => q.where({ name: "Ernie" }),
      polymorphic: true,
      // foreign_type: "sponsorable_type" — not yet in AssociationOptions
      foreignKey: "sponsorable_id",
    } as any);
  }
}
