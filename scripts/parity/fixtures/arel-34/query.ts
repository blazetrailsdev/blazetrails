import { Table, sql } from "@blazetrails/arel";
const posts = new Table("posts");
posts.project(sql("id"), sql("title"));
