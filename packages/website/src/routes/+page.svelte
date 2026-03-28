<script>
  const packages = [
    { name: "ActiveRecord", path: "activerecord", desc: "ORM with migrations, associations, and query building", coverage: "62%" },
    { name: "ActiveModel", path: "activemodel", desc: "Validations, callbacks, dirty tracking, serialization", coverage: "99%" },
    { name: "ActiveSupport", path: "activesupport", desc: "Inflection, caching, notifications, encryption", coverage: "94%" },
    { name: "Arel", path: "arel", desc: "SQL AST builder and query generation", coverage: "99%" },
    { name: "Rack", path: "rack", desc: "Web server interface, middleware, request/response", coverage: "99%" },
    { name: "ActionPack", path: "actionpack", desc: "Controllers, routing, views, sessions, CSRF", coverage: "5%" },
  ];

  const codeExample = `import { Base, Schema } from "@blazetrails/activerecord";

class User extends Base {
  static {
    this.attribute("name", "string");
    this.attribute("email", "string");
    this.hasMany("posts");
  }
}

class Post extends Base {
  static {
    this.attribute("title", "string");
    this.attribute("body", "text");
    this.belongsTo("user");
  }
}

// Feels like Rails. Runs on TypeScript.
const users = await User.where({ name: "Alice" })
  .order("created_at")
  .limit(10);`;

  const railsVsTrails = [
    { rails: "rails new blog", trails: "trails new blog" },
    { rails: "rails generate model Post title:string", trails: "trails generate model Post title:string" },
    { rails: "rails db:migrate", trails: "trails db:migrate" },
    { rails: "rails server", trails: "trails server" },
    { rails: "User.where(name: 'Alice').order(:created_at)", trails: 'User.where({ name: "Alice" }).order("created_at")' },
  ];
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="min-h-screen" style="font-family: var(--font-sans);">

  <!-- Nav -->
  <nav class="border-b border-border/50">
    <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
      <a href="/" class="text-xl font-bold text-accent">BlazeTrails</a>
      <div class="flex items-center gap-6">
        <a href="/docs" class="text-sm text-text-muted hover:text-text">API Docs</a>
        <a href="https://github.com/blazetrailsdev/blazetrails" class="text-sm text-text-muted hover:text-text">GitHub</a>
        <a href="/frontiers" class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover">
          Try Frontiers
        </a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <section class="py-24">
    <div class="mx-auto max-w-5xl px-6">
      <div class="max-w-3xl">
        <p class="mb-4 font-mono text-sm text-accent">Know Rails? Navigate Trails.</p>
        <h1 class="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-text">
          The Rails API,<br />in TypeScript.
        </h1>
        <p class="mb-8 max-w-xl text-lg leading-relaxed text-text-muted">
          BlazeTrails mirrors Ruby on Rails — same class names, same method signatures, same conventions. If you can read the Rails docs, you can use BlazeTrails.
        </p>
        <div class="flex gap-4">
          <a href="/frontiers" class="rounded-lg bg-accent px-6 py-3 font-medium text-surface hover:bg-accent-hover">
            Open Frontiers
          </a>
          <a href="#packages" class="rounded-lg border border-border px-6 py-3 font-medium text-text hover:border-accent hover:text-accent">
            View Packages
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- Side-by-side: Rails vs Trails -->
  <section class="border-y border-border/50 bg-surface-raised py-20">
    <div class="mx-auto max-w-5xl px-6">
      <h2 class="mb-2 text-center text-sm font-medium uppercase tracking-wider text-text-muted">Rails to Trails</h2>
      <p class="mb-12 text-center text-2xl font-bold text-text">Same intent, same names.</p>
      <div class="overflow-hidden rounded-lg border border-border">
        <div class="grid grid-cols-2 border-b border-border bg-surface-overlay text-xs font-medium text-text-muted">
          <div class="px-4 py-2">Ruby on Rails</div>
          <div class="border-l border-border px-4 py-2">BlazeTrails</div>
        </div>
        {#each railsVsTrails as { rails, trails }}
          <div class="grid grid-cols-2 border-b border-border/50 last:border-0">
            <div class="px-4 py-3 font-mono text-xs text-text-muted">{rails}</div>
            <div class="border-l border-border px-4 py-3 font-mono text-xs text-accent">{trails}</div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Code example -->
  <section class="py-20">
    <div class="mx-auto max-w-5xl px-6">
      <div class="grid gap-12 lg:grid-cols-2">
        <div>
          <h2 class="mb-4 text-2xl font-bold text-text">Feels familiar.<br />Types make it better.</h2>
          <p class="mb-6 text-text-muted leading-relaxed">
            BlazeTrails isn't a reimagination of Rails. It's a faithful port.
            ActiveRecord, ActiveModel, Arel, Rack — they're all here, with the same
            class hierarchy and the same call signatures. TypeScript adds the safety
            that Ruby can't.
          </p>
          <ul class="space-y-3 text-sm text-text-muted">
            <li class="flex items-start gap-2">
              <span class="mt-0.5 text-accent">--</span>
              <span>Typed column references, not magic strings</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-0.5 text-accent">--</span>
              <span>Async/await instead of synchronous blocking</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-0.5 text-accent">--</span>
              <span>Same test names, validated against the Rails test suite</span>
            </li>
          </ul>
        </div>
        <div class="overflow-hidden rounded-lg border border-border bg-surface-raised">
          <div class="flex items-center gap-2 border-b border-border px-4 py-2">
            <span class="h-2.5 w-2.5 rounded-full bg-error/60"></span>
            <span class="h-2.5 w-2.5 rounded-full bg-warning/60"></span>
            <span class="h-2.5 w-2.5 rounded-full bg-accent/60"></span>
            <span class="ml-2 font-mono text-[10px] text-text-muted">app/models.ts</span>
          </div>
          <pre class="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-text-muted">{codeExample}</pre>
        </div>
      </div>
    </div>
  </section>

  <!-- Packages -->
  <section id="packages" class="border-y border-border/50 bg-surface-raised py-20">
    <div class="mx-auto max-w-5xl px-6">
      <h2 class="mb-2 text-center text-sm font-medium uppercase tracking-wider text-text-muted">Packages</h2>
      <p class="mb-12 text-center text-2xl font-bold text-text">The full stack, piece by piece.</p>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each packages as pkg}
          <div class="rounded-lg border border-border bg-surface p-5">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="font-mono text-sm font-semibold text-text">{pkg.name}</h3>
              <span class="rounded bg-surface-overlay px-2 py-0.5 font-mono text-[10px] text-text-muted">{pkg.coverage}</span>
            </div>
            <p class="mb-3 text-xs leading-relaxed text-text-muted">{pkg.desc}</p>
            <code class="text-[10px] text-accent">@blazetrails/{pkg.path}</code>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Frontiers CTA -->
  <section class="py-20">
    <div class="mx-auto max-w-5xl px-6 text-center">
      <h2 class="mb-4 text-2xl font-bold text-text">Try it in the browser.</h2>
      <p class="mx-auto mb-8 max-w-lg text-text-muted leading-relaxed">
        Frontiers is a dev sandbox where BlazeTrails runs on WASM SQLite, right in your browser.
        Create models, run migrations, write queries — no install needed.
      </p>
      <div class="flex justify-center gap-4">
        <a href="/frontiers" class="rounded-lg bg-accent px-6 py-3 font-medium text-surface hover:bg-accent-hover">
          Open Frontiers
        </a>
        <a href="/frontiers?embed=true" class="rounded-lg border border-border px-6 py-3 font-medium text-text-muted hover:border-accent hover:text-accent">
          Embed Mode
        </a>
      </div>
      <div class="mt-12 overflow-hidden rounded-lg border border-border shadow-2xl">
        <div class="flex items-center gap-2 border-b border-border bg-surface-raised px-4 py-2">
          <span class="h-2.5 w-2.5 rounded-full bg-error/60"></span>
          <span class="h-2.5 w-2.5 rounded-full bg-warning/60"></span>
          <span class="h-2.5 w-2.5 rounded-full bg-accent/60"></span>
          <span class="ml-2 font-mono text-[10px] text-text-muted">Frontiers</span>
        </div>
        <div class="bg-surface p-6 font-mono text-xs text-text-muted">
          <div class="space-y-1">
            <div><span class="text-accent">$</span> new my-blog</div>
            <div class="text-text-muted pl-4">Creating new trails application: my-blog</div>
            <div class="text-text-muted pl-4">      create  index.html</div>
            <div class="text-text-muted pl-4">      create  app/main.ts</div>
            <div class="text-text-muted pl-4">      create  db/seeds.ts</div>
            <div class="mt-2"><span class="text-accent">$</span> scaffold Post title:string body:text</div>
            <div class="text-text-muted pl-4">      create  app/models/post.ts</div>
            <div class="text-text-muted pl-4">      create  db/migrations/...-create-posts.ts</div>
            <div class="text-text-muted pl-4">      create  app/controllers/posts-controller.ts</div>
            <div class="mt-2"><span class="text-accent">$</span> db:migrate</div>
            <div class="text-text-muted pl-4">All migrations are up to date.</div>
            <div class="mt-2"><span class="text-accent">$</span> await request("GET", "/posts")</div>
            <div class="text-text pl-4">{'{"status": 200, "body": "[]"}'}</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-border/50 py-8">
    <div class="mx-auto max-w-5xl px-6">
      <div class="flex items-center justify-between text-xs text-text-muted">
        <span>BlazeTrails</span>
        <div class="flex gap-6">
          <a href="/docs" class="hover:text-text">API Docs</a>
          <a href="https://github.com/blazetrailsdev/blazetrails" class="hover:text-text">GitHub</a>
          <a href="/frontiers" class="hover:text-text">Frontiers</a>
        </div>
      </div>
    </div>
  </footer>
</div>
