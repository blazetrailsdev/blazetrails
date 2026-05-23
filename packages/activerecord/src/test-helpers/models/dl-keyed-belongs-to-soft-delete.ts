// vendor/rails/activerecord/test/models/dl_keyed_belongs_to_soft_delete.rb
import { Base } from "../../base.js";

export class DlKeyedBelongsToSoftDelete extends Base {
  static {
    this.belongsTo("destroyAsyncParentSoftDelete", {
      dependent: "destroy",
      className: "DestroyAsyncParentSoftDelete",
    });
  }

  deleted?() {
    return (this as any).deleted;
  }

  destroy() {
    (this as any).update({ deleted: true });
    return (this as any).runCallbacks("destroy", () => {});
  }
}
