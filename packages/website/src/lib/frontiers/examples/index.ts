export interface Example {
  name: string;
  code: string;
}

export const examples: Example[] = [
  {
    name: "Load bookstore sample",
    code: `const result = await exec("sample bookstore");
return result.output.join("\\n");`,
  },
  {
    name: "Query with SQL",
    code: `// Run this after loading a sample
const results = adapter.execRaw('SELECT name FROM sqlite_master WHERE type="table"');
return results[0]?.values.map(r => r[0]) ?? "No tables — try: sample bookstore";`,
  },
  {
    name: "Create a table",
    code: `await Schema.define(adapter, (schema) => {
  schema.createTable("users", (t) => {
    t.string("name");
    t.string("email");
    t.integer("age");
    t.timestamps();
  });
});

return "Table 'users' created!";`,
  },
  {
    name: "Scaffold an app",
    code: `await exec("new my-app");
await exec("scaffold Post title:string body:text published:boolean");
const result = await exec("db:migrate");
return result.output.join("\\n");`,
  },
];
