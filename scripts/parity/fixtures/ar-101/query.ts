import { Book } from "./models.js";
import { sql } from "@blazetrails/arel";

export default Book.select(sql("books.*, COUNT(reviews.id) AS review_count"))
  .joins("LEFT JOIN reviews ON reviews.book_id = books.id")
  .group("books.id");
