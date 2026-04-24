-- Fixture for statement: ar-23
-- Query: Developer.from("(<ranked sql>) as developers").order(hotness: :desc).limit(10)

CREATE TABLE developers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  commits INTEGER
);
