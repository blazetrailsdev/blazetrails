export interface Template {
  name: string;
  description: string;
  files: Array<{ path: string; content: string }>;
}

export const templates: Template[] = [
  {
    name: "blank",
    description: "Empty project with a main file",
    files: [{ path: "app/main.ts", content: `// Start coding here\n` }],
  },
  {
    name: "blog",
    description: "Users, posts, and comments",
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html><head><title>Blog</title>
<style>body { font-family: system-ui; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }</style>
</head><body><h1>Blog</h1><div id="posts">Loading...</div>
<script src="/app/main.ts"></script></body></html>
`,
      },
      {
        path: "db/migrations/001_create_users.ts",
        content: `class CreateUsers extends Migration {
  version = "20240101000001";
  async up() {
    await this.schema.createTable("users", (t) => {
      t.string("name");
      t.string("email");
      t.timestamps();
    });
  }
}
runtime.registerMigration({ version: "20240101000001", name: "CreateUsers", migration: () => {
  const m = new CreateUsers(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
}});
return "Registered CreateUsers";
`,
      },
      {
        path: "db/migrations/002_create_posts.ts",
        content: `class CreatePosts extends Migration {
  version = "20240101000002";
  async up() {
    await this.schema.createTable("posts", (t) => {
      t.string("title");
      t.text("body");
      t.integer("user_id");
      t.boolean("published");
      t.timestamps();
    });
  }
}
runtime.registerMigration({ version: "20240101000002", name: "CreatePosts", migration: () => {
  const m = new CreatePosts(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
}});
return "Registered CreatePosts";
`,
      },
      {
        path: "db/migrations/003_create_comments.ts",
        content: `class CreateComments extends Migration {
  version = "20240101000003";
  async up() {
    await this.schema.createTable("comments", (t) => {
      t.text("body");
      t.integer("post_id");
      t.integer("user_id");
      t.timestamps();
    });
  }
}
runtime.registerMigration({ version: "20240101000003", name: "CreateComments", migration: () => {
  const m = new CreateComments(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
}});
return "Registered CreateComments";
`,
      },
      {
        path: "db/seeds.ts",
        content: `await adapter.executeMutation('INSERT INTO "users" ("name","email","created_at","updated_at") VALUES (?,?,datetime("now"),datetime("now"))', ["Alice", "alice@blog.com"]);
await adapter.executeMutation('INSERT INTO "posts" ("title","body","user_id","published","created_at","updated_at") VALUES (?,?,?,?,datetime("now"),datetime("now"))', ["Hello World", "My first post!", 1, 1]);
await adapter.executeMutation('INSERT INTO "comments" ("body","post_id","user_id","created_at","updated_at") VALUES (?,?,?,datetime("now"),datetime("now"))', ["Great post!", 1, 1]);
return "Seeded blog data";
`,
      },
      {
        path: "app/main.ts",
        content: `const posts = await adapter.execute('SELECT p.*, u."name" as author FROM "posts" p JOIN "users" u ON p."user_id" = u."id" WHERE p."published" = 1');
return posts;
`,
      },
    ],
  },
  {
    name: "e-commerce",
    description: "Products, orders, and carts",
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html><head><title>Store</title>
<style>body { font-family: system-ui; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }</style>
</head><body><h1>Store</h1><div id="products">Loading...</div>
<script src="/app/main.ts"></script></body></html>
`,
      },
      {
        path: "db/migrations/001_create_products.ts",
        content: `class CreateProducts extends Migration {
  version = "20240101000001";
  async up() {
    await this.schema.createTable("products", (t) => {
      t.string("name");
      t.text("description");
      t.decimal("price");
      t.integer("stock");
      t.timestamps();
    });
  }
}
runtime.registerMigration({ version: "20240101000001", name: "CreateProducts", migration: () => {
  const m = new CreateProducts(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
}});
return "Registered CreateProducts";
`,
      },
      {
        path: "db/migrations/002_create_orders.ts",
        content: `class CreateOrders extends Migration {
  version = "20240101000002";
  async up() {
    await this.schema.createTable("orders", (t) => {
      t.string("status");
      t.decimal("total");
      t.timestamps();
    });
    await this.schema.createTable("order_items", (t) => {
      t.integer("order_id");
      t.integer("product_id");
      t.integer("quantity");
      t.decimal("unit_price");
    });
  }
}
runtime.registerMigration({ version: "20240101000002", name: "CreateOrders", migration: () => {
  const m = new CreateOrders(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
}});
return "Registered CreateOrders";
`,
      },
      {
        path: "db/seeds.ts",
        content: `await adapter.executeMutation('INSERT INTO "products" ("name","description","price","stock","created_at","updated_at") VALUES (?,?,?,?,datetime("now"),datetime("now"))', ["Widget", "A fine widget", 9.99, 100]);
await adapter.executeMutation('INSERT INTO "products" ("name","description","price","stock","created_at","updated_at") VALUES (?,?,?,?,datetime("now"),datetime("now"))', ["Gadget", "A cool gadget", 24.99, 50]);
await adapter.executeMutation('INSERT INTO "products" ("name","description","price","stock","created_at","updated_at") VALUES (?,?,?,?,datetime("now"),datetime("now"))', ["Doohickey", "Essential doohickey", 4.99, 200]);
return "Seeded 3 products";
`,
      },
      {
        path: "app/main.ts",
        content: `const products = await adapter.execute('SELECT * FROM "products" WHERE "stock" > 0 ORDER BY "price"');
return products;
`,
      },
    ],
  },
  {
    name: "api",
    description: "REST API with Rack routes",
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html><head><title>API Sandbox</title>
<style>body { font-family: monospace; max-width: 640px; margin: 2rem auto; padding: 0 1rem; background: #0f1117; color: #e2e8f0; }</style>
</head><body><h1>API Sandbox</h1><p>This template sets up a basic data model. Use the SQL and REPL tabs to interact.</p></body></html>
`,
      },
      {
        path: "db/migrations/001_create_resources.ts",
        content: `class CreateResources extends Migration {
  version = "20240101000001";
  async up() {
    await this.schema.createTable("resources", (t) => {
      t.string("type");
      t.string("name");
      t.text("data");
      t.timestamps();
    });
  }
}
runtime.registerMigration({ version: "20240101000001", name: "CreateResources", migration: () => {
  const m = new CreateResources(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
}});
return "Registered CreateResources";
`,
      },
      {
        path: "app/main.ts",
        content: `// API-style CRUD operations
async function createResource(type, name, data) {
  return adapter.executeMutation(
    'INSERT INTO "resources" ("type","name","data","created_at","updated_at") VALUES (?,?,?,datetime("now"),datetime("now"))',
    [type, name, JSON.stringify(data)]
  );
}

async function listResources(type) {
  return adapter.execute('SELECT * FROM "resources" WHERE "type" = ? ORDER BY "created_at" DESC', [type]);
}

// Create some test data
await createResource("user", "alice", { role: "admin" });
await createResource("user", "bob", { role: "viewer" });
await createResource("config", "settings", { theme: "dark", lang: "en" });

return await listResources("user");
`,
      },
    ],
  },
];
