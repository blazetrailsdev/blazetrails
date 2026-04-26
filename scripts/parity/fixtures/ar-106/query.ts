import { Book } from "./models.js";

export default Book.order("author_id ASC, title DESC");
