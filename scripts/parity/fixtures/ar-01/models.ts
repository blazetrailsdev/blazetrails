import { Base } from "@blazetrails/activerecord";

export class Book extends Base {
  static {
    this.tableName = "books";
    this.hasMany("reviews");
  }
}

export class Review extends Base {
  static {
    this.tableName = "reviews";
    this.belongsTo("book");
  }
}
