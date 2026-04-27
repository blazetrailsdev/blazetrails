-- Query: union = Book.where(status: "active").union(Book.where(status: "featured")); Book.from(union.as("all_books")).select("all_books.*").order("all_books.id")
CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL);
