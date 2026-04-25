import { Book } from "./models.js";

export default Book.all().leftOuterJoins("authors", '"authors"."id" = "books"."author_id"');
