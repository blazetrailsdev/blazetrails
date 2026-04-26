-- Fixture for statement: ar-113
-- Query: Book.where(active: true).order(:title).except(:order)

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT,
  active BOOLEAN
);
