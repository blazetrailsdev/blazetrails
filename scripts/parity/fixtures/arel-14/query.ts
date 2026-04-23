import { Table } from "@blazetrails/arel";
const users = new Table("users");
users.get("name").notIn(["Mike", "Molly"]);
