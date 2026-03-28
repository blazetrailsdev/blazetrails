/**
 * Pre-built sample databases with realistic data for the Frontiers sandbox.
 * Each sample is a set of SQL statements that creates tables and inserts data.
 */

export interface SampleDatabase {
  name: string;
  description: string;
  sql: string;
}

export const sampleDatabases: SampleDatabase[] = [
  {
    name: "bookstore",
    description: "Authors, books, reviews — a cozy bookshop",
    sql: `
CREATE TABLE "authors" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "bio" TEXT,
  "born_year" INTEGER,
  "country" TEXT,
  "created_at" TEXT DEFAULT (datetime('now'))
);

CREATE TABLE "books" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "author_id" INTEGER REFERENCES "authors"("id"),
  "isbn" TEXT,
  "published_year" INTEGER,
  "genre" TEXT,
  "pages" INTEGER,
  "price" REAL,
  "in_stock" INTEGER DEFAULT 1,
  "created_at" TEXT DEFAULT (datetime('now'))
);

CREATE TABLE "reviews" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "book_id" INTEGER REFERENCES "books"("id"),
  "reviewer" TEXT NOT NULL,
  "rating" INTEGER CHECK (rating BETWEEN 1 AND 5),
  "body" TEXT,
  "created_at" TEXT DEFAULT (datetime('now'))
);

INSERT INTO "authors" ("name", "bio", "born_year", "country") VALUES
  ('Ursula K. Le Guin', 'American author of speculative fiction', 1929, 'USA'),
  ('Jorge Luis Borges', 'Argentine writer of labyrinthine stories', 1899, 'Argentina'),
  ('Octavia E. Butler', 'Pioneer of Afrofuturist science fiction', 1947, 'USA'),
  ('Italo Calvino', 'Italian fabulist and literary experimentalist', 1923, 'Italy'),
  ('Clarice Lispector', 'Brazilian novelist of interior experience', 1920, 'Brazil'),
  ('Stanislaw Lem', 'Polish author of philosophical science fiction', 1921, 'Poland'),
  ('Toni Morrison', 'Nobel laureate exploring Black American life', 1931, 'USA'),
  ('Gabriel Garcia Marquez', 'Colombian master of magical realism', 1927, 'Colombia');

INSERT INTO "books" ("title", "author_id", "isbn", "published_year", "genre", "pages", "price") VALUES
  ('The Left Hand of Darkness', 1, '978-0441478125', 1969, 'Science Fiction', 304, 15.99),
  ('The Dispossessed', 1, '978-0061054884', 1974, 'Science Fiction', 387, 16.99),
  ('A Wizard of Earthsea', 1, '978-0547722023', 1968, 'Fantasy', 183, 12.99),
  ('Ficciones', 2, '978-0802130303', 1944, 'Fiction', 174, 14.99),
  ('Labyrinths', 2, '978-0811216999', 1962, 'Fiction', 240, 16.99),
  ('Kindred', 3, '978-0807083697', 1979, 'Science Fiction', 264, 14.99),
  ('Parable of the Sower', 3, '978-1538732182', 1993, 'Science Fiction', 345, 16.99),
  ('If on a Winter''s Night a Traveler', 4, '978-0156439619', 1979, 'Fiction', 260, 15.99),
  ('Invisible Cities', 4, '978-0156453806', 1972, 'Fiction', 165, 14.99),
  ('The Passion According to G.H.', 5, '978-0811219686', 1964, 'Fiction', 192, 13.99),
  ('Solaris', 6, '978-0156027601', 1961, 'Science Fiction', 204, 14.99),
  ('The Cyberiad', 6, '978-0156027786', 1965, 'Science Fiction', 295, 15.99),
  ('Beloved', 7, '978-1400033416', 1987, 'Fiction', 324, 16.99),
  ('Song of Solomon', 7, '978-1400033423', 1977, 'Fiction', 337, 15.99),
  ('One Hundred Years of Solitude', 8, '978-0060883287', 1967, 'Fiction', 417, 17.99),
  ('Love in the Time of Cholera', 8, '978-0307389732', 1985, 'Fiction', 348, 16.99);

INSERT INTO "reviews" ("book_id", "reviewer", "rating", "body") VALUES
  (1, 'River', 5, 'Changed how I think about gender and society'),
  (1, 'Moss', 4, 'Dense but rewarding. The worldbuilding is incredible.'),
  (2, 'Cedar', 5, 'The best exploration of anarchism in fiction'),
  (4, 'Ash', 5, 'Every story is a perfect puzzle'),
  (4, 'Birch', 5, 'I reread "The Garden of Forking Paths" every year'),
  (6, 'Elm', 5, 'Devastating and necessary'),
  (6, 'Sage', 4, 'Time travel used to make you feel something real'),
  (8, 'Fern', 5, 'The most inventive novel structure I''ve encountered'),
  (9, 'Clay', 4, 'Each city is a poem'),
  (11, 'Stone', 5, 'The ocean is a character'),
  (11, 'Brook', 3, 'Philosophically interesting but slow'),
  (13, 'Willow', 5, 'Heartbreaking and beautiful'),
  (15, 'Rain', 5, 'A century of wonder in one family'),
  (15, 'Dusk', 4, 'Magic and grief woven together perfectly'),
  (16, 'Hazel', 5, 'The greatest love story ever written');
`,
  },
  {
    name: "music",
    description: "Artists, albums, tracks — a record collection",
    sql: `
CREATE TABLE "artists" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "genre" TEXT,
  "country" TEXT,
  "formed_year" INTEGER
);

CREATE TABLE "albums" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "artist_id" INTEGER REFERENCES "artists"("id"),
  "released_year" INTEGER,
  "label" TEXT,
  "format" TEXT DEFAULT 'vinyl'
);

CREATE TABLE "tracks" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "album_id" INTEGER REFERENCES "albums"("id"),
  "number" INTEGER,
  "title" TEXT NOT NULL,
  "duration_seconds" INTEGER
);

INSERT INTO "artists" ("name", "genre", "country", "formed_year") VALUES
  ('Boards of Canada', 'Electronic', 'Scotland', 1986),
  ('Khruangbin', 'Psychedelic', 'USA', 2010),
  ('Mdou Moctar', 'Tuareg Rock', 'Niger', 2008),
  ('Sault', 'Soul/Funk', 'UK', 2019),
  ('Floating Points', 'Electronic', 'UK', 2009),
  ('Black Midi', 'Experimental Rock', 'UK', 2017);

INSERT INTO "albums" ("title", "artist_id", "released_year", "label", "format") VALUES
  ('Music Has the Right to Children', 1, 1998, 'Warp', 'vinyl'),
  ('Geogaddi', 1, 2002, 'Warp', 'vinyl'),
  ('Con Todo El Mundo', 2, 2018, 'Dead Oceans', 'vinyl'),
  ('Mordechai', 2, 2020, 'Dead Oceans', 'vinyl'),
  ('Afrique Victime', 3, 2021, 'Matador', 'vinyl'),
  ('Untitled (Black Is)', 4, 2020, 'Forever Living Originals', 'digital'),
  ('5', 4, 2019, 'Forever Living Originals', 'digital'),
  ('Crush', 5, 2019, 'Ninja Tune', 'vinyl'),
  ('Promises', 5, 2021, 'Luaka Bop', 'vinyl'),
  ('Cavalcade', 6, 2021, 'Rough Trade', 'vinyl');

INSERT INTO "tracks" ("album_id", "number", "title", "duration_seconds") VALUES
  (1, 1, 'Wildlife Analysis', 288), (1, 2, 'An Eagle in Your Mind', 393),
  (1, 3, 'The Color of the Fire', 107), (1, 4, 'Telephasic Workshop', 397),
  (1, 5, 'Triangles & Rhombuses', 74), (1, 6, 'Sixtyten', 360),
  (1, 7, 'Turquoise Hexagon Sun', 325), (1, 8, 'Kaini Industries', 62),
  (1, 9, 'Bocuma', 286), (1, 10, 'Roygbiv', 139),
  (3, 1, 'Como Me Quieres', 244), (3, 2, 'Evan Finds the Third Room', 217),
  (3, 3, 'Maria También', 230), (3, 4, 'Cómo Te Quiero', 217),
  (5, 1, 'Chismiten', 265), (5, 2, 'Taliat', 357),
  (5, 3, 'Ya Habibti', 249), (5, 4, 'Afrique Victime', 525),
  (9, 1, 'Promises (Movement 1)', 480), (9, 2, 'Promises (Movement 5)', 540),
  (10, 1, 'John L', 384), (10, 2, 'Marlene Dietrich', 350),
  (10, 3, 'Chondromalacia Patella', 252), (10, 4, 'Slow', 512);
`,
  },
  {
    name: "national-parks",
    description: "Parks, trails, wildlife — the great outdoors",
    sql: `
CREATE TABLE "parks" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "established_year" INTEGER,
  "area_acres" INTEGER,
  "visitors_2023" INTEGER,
  "description" TEXT
);

CREATE TABLE "trails" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "park_id" INTEGER REFERENCES "parks"("id"),
  "name" TEXT NOT NULL,
  "distance_miles" REAL,
  "elevation_gain_ft" INTEGER,
  "difficulty" TEXT CHECK (difficulty IN ('easy', 'moderate', 'hard', 'strenuous')),
  "features" TEXT
);

CREATE TABLE "wildlife" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "park_id" INTEGER REFERENCES "parks"("id"),
  "species" TEXT NOT NULL,
  "category" TEXT,
  "conservation_status" TEXT,
  "population_estimate" INTEGER
);

INSERT INTO "parks" ("name", "state", "established_year", "area_acres", "visitors_2023", "description") VALUES
  ('Yellowstone', 'Wyoming', 1872, 2219791, 4500000, 'First national park. Geysers, hot springs, and wildlife'),
  ('Yosemite', 'California', 1890, 761748, 3900000, 'Granite cliffs, waterfalls, and giant sequoias'),
  ('Olympic', 'Washington', 1938, 922650, 3500000, 'Rainforest, mountains, and rugged coastline'),
  ('Acadia', 'Maine', 1919, 49075, 4000000, 'Rocky coastline on the Atlantic'),
  ('Great Smoky Mountains', 'Tennessee', 1934, 522427, 12500000, 'Most visited park. Ancient mountains and diverse forests'),
  ('Zion', 'Utah', 1919, 147242, 4700000, 'Red rock canyons and sandstone cliffs'),
  ('Glacier', 'Montana', 1910, 1013322, 2900000, 'Pristine forests, alpine meadows, and retreating glaciers'),
  ('Big Bend', 'Texas', 1944, 801163, 450000, 'Desert, mountains, and the Rio Grande');

INSERT INTO "trails" ("park_id", "name", "distance_miles", "elevation_gain_ft", "difficulty", "features") VALUES
  (1, 'Old Faithful to Biscuit Basin', 4.8, 200, 'easy', 'Geysers, hot springs, boardwalks'),
  (1, 'Mount Washburn', 6.4, 1400, 'moderate', 'Panoramic views, wildflowers, bighorn sheep'),
  (1, 'Lamar Valley Trail', 3.0, 100, 'easy', 'Best wildlife viewing in the park'),
  (2, 'Mist Trail', 5.4, 1900, 'strenuous', 'Vernal and Nevada Falls'),
  (2, 'Half Dome', 14.0, 4800, 'strenuous', 'Iconic granite dome, cables section'),
  (2, 'Valley View Trail', 1.3, 50, 'easy', 'River views, El Capitan vista'),
  (3, 'Hoh Rain Forest', 1.1, 50, 'easy', 'Moss-draped old growth forest'),
  (3, 'Hurricane Ridge', 3.2, 650, 'moderate', 'Alpine meadows, mountain views'),
  (4, 'Precipice Trail', 1.6, 1000, 'strenuous', 'Iron rungs, ladders, exposed ledges'),
  (4, 'Jordan Pond Path', 3.3, 100, 'easy', 'Lake loop with mountain views'),
  (5, 'Alum Cave Trail', 5.0, 1200, 'moderate', 'Rock arches, views, access to Mt. LeConte'),
  (5, 'Clingmans Dome', 1.0, 330, 'moderate', 'Highest point in the Smokies'),
  (6, 'Angels Landing', 5.4, 1488, 'strenuous', 'Chain-assisted climb, 1000ft drop-offs'),
  (6, 'The Narrows', 9.4, 334, 'hard', 'Wading through the Virgin River canyon'),
  (7, 'Highline Trail', 11.4, 800, 'moderate', 'Continental Divide views, mountain goats'),
  (7, 'Grinnell Glacier', 7.6, 1600, 'strenuous', 'One of the last remaining glaciers'),
  (8, 'Santa Elena Canyon', 1.4, 80, 'easy', '1500-foot limestone canyon walls'),
  (8, 'Emory Peak', 10.5, 2500, 'strenuous', 'Highest point in Big Bend');

INSERT INTO "wildlife" ("park_id", "species", "category", "conservation_status", "population_estimate") VALUES
  (1, 'Gray Wolf', 'Mammal', 'Recovered', 100),
  (1, 'Grizzly Bear', 'Mammal', 'Threatened', 700),
  (1, 'Bison', 'Mammal', 'Near Threatened', 5000),
  (1, 'Elk', 'Mammal', 'Least Concern', 20000),
  (2, 'Black Bear', 'Mammal', 'Least Concern', 500),
  (2, 'Peregrine Falcon', 'Bird', 'Least Concern', 20),
  (3, 'Roosevelt Elk', 'Mammal', 'Least Concern', 5000),
  (3, 'Marbled Murrelet', 'Bird', 'Threatened', 200),
  (4, 'Peregrine Falcon', 'Bird', 'Least Concern', 30),
  (5, 'Synchronous Firefly', 'Insect', 'Not Evaluated', 1000000),
  (5, 'Eastern Box Turtle', 'Reptile', 'Vulnerable', 10000),
  (6, 'California Condor', 'Bird', 'Critically Endangered', 22),
  (6, 'Desert Bighorn Sheep', 'Mammal', 'Least Concern', 600),
  (7, 'Mountain Goat', 'Mammal', 'Least Concern', 350),
  (7, 'Wolverine', 'Mammal', 'Threatened', 30),
  (8, 'Mountain Lion', 'Mammal', 'Least Concern', 25),
  (8, 'Colima Warbler', 'Bird', 'Least Concern', 100);
`,
  },
  {
    name: "recipes",
    description: "Dishes, ingredients, steps — a community cookbook",
    sql: `
CREATE TABLE "recipes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "cuisine" TEXT,
  "course" TEXT,
  "prep_minutes" INTEGER,
  "cook_minutes" INTEGER,
  "servings" INTEGER,
  "difficulty" TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  "vegetarian" INTEGER DEFAULT 0
);

CREATE TABLE "ingredients" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "recipe_id" INTEGER REFERENCES "recipes"("id"),
  "item" TEXT NOT NULL,
  "amount" TEXT,
  "unit" TEXT,
  "optional" INTEGER DEFAULT 0
);

CREATE TABLE "steps" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "recipe_id" INTEGER REFERENCES "recipes"("id"),
  "number" INTEGER,
  "instruction" TEXT NOT NULL,
  "duration_minutes" INTEGER
);

INSERT INTO "recipes" ("name", "cuisine", "course", "prep_minutes", "cook_minutes", "servings", "difficulty", "vegetarian") VALUES
  ('Shakshuka', 'Middle Eastern', 'breakfast', 10, 25, 4, 'beginner', 1),
  ('Pad Thai', 'Thai', 'main', 20, 10, 2, 'intermediate', 0),
  ('Risotto ai Funghi', 'Italian', 'main', 10, 35, 4, 'intermediate', 1),
  ('Miso Soup', 'Japanese', 'starter', 5, 10, 4, 'beginner', 1),
  ('Tacos al Pastor', 'Mexican', 'main', 30, 15, 6, 'intermediate', 0),
  ('Dal Makhani', 'Indian', 'main', 15, 60, 6, 'intermediate', 1),
  ('Chocolate Lava Cake', 'French', 'dessert', 15, 12, 2, 'advanced', 1);

INSERT INTO "ingredients" ("recipe_id", "item", "amount", "unit") VALUES
  (1, 'canned tomatoes', '400', 'g'), (1, 'eggs', '4', 'whole'),
  (1, 'onion', '1', 'large'), (1, 'garlic', '3', 'cloves'),
  (1, 'cumin', '1', 'tsp'), (1, 'paprika', '1', 'tsp'),
  (1, 'feta cheese', '50', 'g'),
  (2, 'rice noodles', '200', 'g'), (2, 'shrimp', '200', 'g'),
  (2, 'tamarind paste', '2', 'tbsp'), (2, 'fish sauce', '2', 'tbsp'),
  (2, 'bean sprouts', '100', 'g'), (2, 'peanuts', '50', 'g'),
  (3, 'arborio rice', '300', 'g'), (3, 'mushrooms', '200', 'g'),
  (3, 'vegetable broth', '1', 'L'), (3, 'parmesan', '80', 'g'),
  (3, 'white wine', '120', 'ml'), (3, 'butter', '30', 'g'),
  (4, 'dashi stock', '800', 'ml'), (4, 'miso paste', '3', 'tbsp'),
  (4, 'tofu', '150', 'g'), (4, 'wakame seaweed', '5', 'g'),
  (4, 'green onion', '2', 'stalks'),
  (6, 'black lentils', '250', 'g'), (6, 'kidney beans', '100', 'g'),
  (6, 'tomato puree', '200', 'g'), (6, 'cream', '100', 'ml'),
  (6, 'butter', '50', 'g'), (6, 'garam masala', '2', 'tsp'),
  (7, 'dark chocolate', '120', 'g'), (7, 'butter', '60', 'g'),
  (7, 'eggs', '2', 'whole'), (7, 'sugar', '50', 'g'),
  (7, 'flour', '20', 'g');

INSERT INTO "steps" ("recipe_id", "number", "instruction", "duration_minutes") VALUES
  (1, 1, 'Sauté onion and garlic in olive oil until soft', 5),
  (1, 2, 'Add spices and cook until fragrant', 1),
  (1, 3, 'Pour in tomatoes and simmer', 10),
  (1, 4, 'Make wells and crack eggs in. Cover and cook until set.', 8),
  (3, 1, 'Sauté mushrooms in butter, set aside', 5),
  (3, 2, 'Toast rice in butter, add wine', 3),
  (3, 3, 'Add broth one ladle at a time, stirring constantly', 25),
  (3, 4, 'Fold in mushrooms, parmesan, and a knob of butter', 2),
  (7, 1, 'Melt chocolate and butter together gently', 5),
  (7, 2, 'Whisk eggs and sugar until thick and pale', 5),
  (7, 3, 'Fold chocolate into eggs, then fold in flour', 2),
  (7, 4, 'Pour into ramekins. Bake at 220C until edges set but center jiggles.', 12);
`,
  },
];
