import { Book } from "./models.js";

export default Book.where(Book.arelTable.get("pages").between(100, 500));
