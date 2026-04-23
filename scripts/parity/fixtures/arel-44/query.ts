import { Table } from "@blazetrails/arel";
const users = new Table("users");
const posts = new Table("posts");
const comments = new Table("comments");
const sub = posts.join(comments).on(posts.get("id").eq(comments.get("post_id")));
users.join(sub).on(posts.get("user_id").eq(users.get("id")));
