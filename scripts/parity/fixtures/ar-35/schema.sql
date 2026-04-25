-- Fixture for statement: ar-35
-- Query: Book.optimizer_hints("USE_INDEX(books, idx_title)").where(id: 1)

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT
);
