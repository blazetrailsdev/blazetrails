import { Book } from "./models.js";
import { sql } from "@blazetrails/arel";

export default Book.select("author_id", sql("COUNT(*) AS book_count"))
  .group("author_id")
  .having(sql("COUNT(*) > 2"));
