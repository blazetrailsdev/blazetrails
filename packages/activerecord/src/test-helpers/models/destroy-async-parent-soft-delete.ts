// vendor/rails/activerecord/test/models/destroy_async_parent_soft_delete.rb
import { Base } from "../../base.js";

export class DestroyAsyncParentSoftDelete extends Base {
  static {
    this.hasMany("taggings", { as: "taggable", className: "Tagging" });
    this.hasMany("tags", {
      through: "taggings",
      dependent: "destroy",
    });
    this.hasOne("dlKeyedHasOne", {
      dependent: "destroy",
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
