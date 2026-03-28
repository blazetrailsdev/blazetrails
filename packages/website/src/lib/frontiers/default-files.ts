export const defaultFiles = [
  {
    path: "README.md",
    content: `# Welcome to Frontiers

## Quick start — load a sample database

  $ sample bookstore
  $ sql queries/bookstore/overview.sql
  $ sql queries/bookstore/top-rated.sql

Other samples: music, national-parks, recipes

  $ sample

## Build from scratch

  $ new my-app
  $ g model User name:string email:string
  $ scaffold Post title:string body:text
  $ db:migrate
  $ db:seed

## Run SQL directly

  $ sql SELECT sqlite_version()
  $ sql SELECT * FROM books WHERE genre = 'Science Fiction'

## Execute files

  $ run queries/bookstore/top-rated.sql
  $ run app/main.ts
`,
  },
];
