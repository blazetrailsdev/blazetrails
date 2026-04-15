export class Post extends Base {
  declare tags: AssociationProxy<Tag>;

  static {
    this.hasAndBelongsToMany("tags");
  }
}
