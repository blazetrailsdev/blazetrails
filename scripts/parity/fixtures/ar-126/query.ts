import { Book } from "./models.js";
import { sql } from "@blazetrails/arel";

export default Book.order(sql("CASE WHEN status = 'featured' THEN 0 ELSE 1 END"));
