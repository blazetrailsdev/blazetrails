import { ref } from "../define-fixtures.js";

// activerecord/test/fixtures/books.yml
// Enum integer mappings from activerecord/test/models/book.rb:
//   status: proposed=0, written=1, published=2
//   last_read: unread=0, reading=2, read=3, forgotten=nil
//   language: english=0, spanish=1, french=2
//   author_visibility / illustrator_visibility: visible=0, invisible=1
//   font_size: small=0, medium=1, large=2
//   difficulty: easy=0, medium=1, hard=2
//   boolean_status: { enabled: true(1), disabled: false(0) }
//   cover: string enum { hard: "hard", soft: "soft" }
export const bookFixtureData = {
  awdr: {
    author_id: ref("authors", "david"),
    name: "Agile Web Development with Rails",
    format: "paperback",
    status: 2,
    last_read: 3,
    language: 0,
    author_visibility: 0,
    illustrator_visibility: 0,
    font_size: 1,
    difficulty: 1,
    boolean_status: 1,
    cover: "soft",
  },
  rfr: {
    author_id: ref("authors", "david"),
    name: "Ruby for Rails",
    format: "ebook",
    status: 0,
    last_read: 2,
  },
  ddd: {
    author_id: ref("authors", "david"),
    name: "Domain-Driven Design",
    format: "hardcover",
    status: 2,
  },
  tlg: {
    author_id: ref("authors", "david"),
    name: "Thoughtleadering",
  },
};
