import { ref } from "../define-fixtures.js";

// activerecord/test/fixtures/books.yml
export const bookFixtureData = {
  awdr: {
    id: 1,
    author_id: ref("authors", "david"),
    name: "Agile Web Development with Rails",
    format: "paperback",
  },
  rfr: {
    id: 2,
    author_id: ref("authors", "david"),
    name: "Ruby for Rails",
    format: "ebook",
  },
  ddd: {
    id: 3,
    author_id: ref("authors", "david"),
    name: "Domain-Driven Design",
    format: "hardcover",
  },
  tlg: {
    id: 4,
    author_id: ref("authors", "david"),
    name: "Thoughtleadering",
  },
};
