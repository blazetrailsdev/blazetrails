export class Blog extends Base {
  declare posts: AssociationProxy<Post>;
  declare comments: AssociationProxy<Comment>;

  static {
    this.hasMany("posts");
    this.hasMany("comments");
  }
}
