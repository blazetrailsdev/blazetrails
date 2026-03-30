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

  <!-- Hero with full-bleed wilderness SVG -->
  <section class="hero-section relative w-full overflow-hidden">
    <!-- Nav overlay -->
    <nav class="absolute top-0 left-0 right-0 z-20">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a href="/" class="text-xl font-bold" style="color: #7db060;">BlazeTrails</a>
        <div class="flex items-center gap-6">
          <a href="/docs" class="text-sm" style="color: #e4ded4cc;" onmouseenter={(e) => e.currentTarget.style.color = '#e4ded4'} onmouseleave={(e) => e.currentTarget.style.color = '#e4ded4cc'}>API Docs</a>
          <a href="https://github.com/blazetrailsdev/blazetrails" class="text-sm" style="color: #e4ded4cc;" onmouseenter={(e) => e.currentTarget.style.color = '#e4ded4'} onmouseleave={(e) => e.currentTarget.style.color = '#e4ded4cc'}>GitHub</a>
          <a href="/frontiers" class="rounded-lg px-4 py-2 text-sm font-medium" style="background: #6b9e50; color: #1c1916;">
            Try Frontiers
          </a>
        </div>
      </div>
    </nav>

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" class="hero-svg block w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <!-- Sky gradient — large sky area -->
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a2a3a" />
          <stop offset="30%" stop-color="#2d4a5e" />
          <stop offset="60%" stop-color="#5a7a6a" />
          <stop offset="80%" stop-color="#8aaa7a" />
          <stop offset="100%" stop-color="#c8b890" />
        </linearGradient>
        <!-- Warm glow near horizon -->
        <radialGradient id="horizonGlow" cx="50%" cy="72%" r="40%">
          <stop offset="0%" stop-color="#d4883a" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#d4883a" stop-opacity="0" />
        </radialGradient>
        <!-- Fire text gradient -->
        <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff6b2a" />
          <stop offset="40%" stop-color="#e8451a" />
          <stop offset="70%" stop-color="#d4360f" />
          <stop offset="100%" stop-color="#b02a0a" />
        </linearGradient>
        <!-- Fire glow filter -->
        <filter id="fireGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.2  0 0.4 0 0 0  0 0 0.1 0 0  0 0 0 0.6 0" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <!-- Subtle haze -->
        <filter id="haze">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      <!-- Sky -->
      <rect width="1600" height="900" fill="url(#sky)" />
      <rect width="1600" height="900" fill="url(#horizonGlow)" />

      <!-- Distant mountains — very far, hazy blue-green -->
      <path d="M0 520 Q200 380 400 440 Q500 410 620 460 Q750 370 900 430 Q1020 390 1100 450 Q1250 380 1400 420 Q1500 400 1600 450 L1600 600 L0 600Z" fill="#3a5548" opacity="0.5" filter="url(#haze)" />

      <!-- Mid mountains — green-brown -->
      <path d="M0 540 Q150 440 300 500 Q420 460 550 510 Q680 440 800 490 Q930 450 1050 500 Q1200 440 1350 480 Q1480 460 1600 500 L1600 650 L0 650Z" fill="#4a6648" opacity="0.7" />

      <!-- Rolling hills — back layer -->
      <path d="M0 580 Q100 530 250 560 Q400 520 550 555 Q700 515 850 550 Q1000 520 1150 545 Q1300 510 1450 540 Q1550 525 1600 550 L1600 700 L0 700Z" fill="#3d5a35" />

      <!-- Forest tree line — back row (distant, smaller) -->
      <g fill="#2d4a28" opacity="0.8">
        <!-- Scattered conifers along back hills -->
        <polygon points="80,560 90,510 100,560" />
        <polygon points="120,555 132,498 144,555" />
        <polygon points="170,565 180,520 190,565" />
        <polygon points="230,550 243,488 256,550" />
        <polygon points="280,558 290,510 300,558" />
        <polygon points="340,548 352,490 364,548" />
        <polygon points="400,555 412,505 424,555" />
        <polygon points="460,545 473,483 486,545" />
        <polygon points="520,552 530,502 540,552" />
        <polygon points="590,540 603,478 616,540" />
        <polygon points="660,548 670,500 680,548" />
        <polygon points="730,538 743,476 756,538" />
        <polygon points="800,545 810,495 820,545" />
        <polygon points="870,535 883,475 896,535" />
        <polygon points="940,542 950,492 960,542" />
        <polygon points="1010,530 1023,470 1036,530" />
        <polygon points="1080,538 1090,488 1100,538" />
        <polygon points="1150,528 1163,468 1176,528" />
        <polygon points="1220,535 1230,485 1240,535" />
        <polygon points="1290,525 1303,465 1316,525" />
        <polygon points="1360,532 1370,482 1380,532" />
        <polygon points="1430,522 1443,462 1456,522" />
        <polygon points="1510,530 1520,478 1530,530" />
        <polygon points="1570,525 1583,470 1596,525" />
      </g>

      <!-- Rolling hills — mid layer -->
      <path d="M0 620 Q200 570 400 600 Q600 560 800 590 Q1000 555 1200 585 Q1400 560 1600 590 L1600 750 L0 750Z" fill="#4a6a3a" />

      <!-- Forest tree line — mid row -->
      <g fill="#2a5022">
        <polygon points="50,615 65,548 80,615" />
        <polygon points="100,610 118,535 136,610" />
        <polygon points="160,620 175,555 190,620" />
        <polygon points="215,608 233,530 251,608" />
        <polygon points="270,618 285,552 300,618" />
        <polygon points="330,605 348,528 366,605" />
        <polygon points="390,612 405,548 420,612" />
        <polygon points="450,600 468,522 486,600" />
        <polygon points="510,608 525,545 540,608" />
        <polygon points="570,595 588,518 606,595" />
        <polygon points="635,605 650,542 665,605" />
        <polygon points="700,592 718,515 736,592" />
        <polygon points="760,600 775,538 790,600" />
        <polygon points="825,588 843,510 861,588" />
        <polygon points="890,595 905,532 920,595" />
        <polygon points="955,582 973,505 991,582" />
        <polygon points="1020,590 1035,528 1050,590" />
        <polygon points="1085,578 1103,500 1121,578" />
        <polygon points="1150,585 1165,522 1180,585" />
        <polygon points="1220,575 1238,498 1256,575" />
        <polygon points="1290,582 1305,520 1320,582" />
        <polygon points="1355,572 1373,495 1391,572" />
        <polygon points="1420,580 1435,518 1450,580" />
        <polygon points="1490,570 1508,492 1526,570" />
        <polygon points="1560,578 1575,515 1590,578" />
      </g>

      <!-- Rolling hills — front layer -->
      <path d="M0 670 Q150 630 350 655 Q550 620 750 645 Q950 615 1150 640 Q1350 620 1600 650 L1600 800 L0 800Z" fill="#3a5a2e" />

      <!-- Forest tree line — front row (closer, larger) -->
      <g fill="#1e3a18">
        <polygon points="20,668 42,575 64,668" />
        <polygon points="80,660 105,558 130,660" />
        <polygon points="155,670 175,580 195,670" />
        <polygon points="220,658 245,555 270,658" />
        <polygon points="295,665 315,575 335,665" />
        <polygon points="360,652 385,548 410,652" />
        <polygon points="430,660 450,570 470,660" />
        <polygon points="495,648 520,545 545,648" />
        <polygon points="565,655 585,565 605,655" />
        <polygon points="630,642 655,540 680,642" />
        <polygon points="700,650 720,560 740,650" />
        <polygon points="765,638 790,535 815,638" />
        <polygon points="835,645 855,555 875,645" />
        <polygon points="900,632 925,530 950,632" />
        <polygon points="970,640 990,550 1010,640" />
        <polygon points="1035,628 1060,525 1085,628" />
        <polygon points="1105,635 1125,545 1145,635" />
        <polygon points="1170,622 1195,520 1220,622" />
        <polygon points="1240,630 1260,540 1280,630" />
        <polygon points="1305,618 1330,515 1355,618" />
        <polygon points="1375,625 1395,535 1415,625" />
        <polygon points="1440,615 1465,512 1490,615" />
        <polygon points="1510,622 1530,530 1550,622" />
        <polygon points="1565,618 1585,525 1605,618" />
      </g>

      <!-- Foreground hills — earthy brown -->
      <path d="M0 730 Q200 690 400 710 Q600 680 800 705 Q1000 675 1200 700 Q1400 680 1600 710 L1600 900 L0 900Z" fill="#3a3020" />

      <!-- Foreground ground — dark earth -->
      <path d="M0 790 Q400 760 800 775 Q1200 755 1600 770 L1600 900 L0 900Z" fill="#2a2218" />

      <!-- A winding trail/path through the foreground -->
      <path d="M720 900 Q740 850 760 810 Q780 780 790 750 Q800 720 810 700" stroke="#8a7a60" stroke-width="4" fill="none" opacity="0.5" stroke-linecap="round" />
      <path d="M722 900 Q742 848 762 808 Q782 778 792 748 Q802 718 812 698" stroke="#a09070" stroke-width="2" fill="none" opacity="0.3" stroke-linecap="round" />

      <!-- ===== BLAZETRAILS WORDMARK ===== -->

      <!-- "Blaze" — fiery -->
      <text x="580" y="380" font-family="Inter, system-ui, sans-serif" font-size="108" font-weight="800" letter-spacing="-2" fill="url(#fireGrad)" filter="url(#fireGlow)">Blaze</text>

      <!-- "Trails" — forest green -->
      <text x="925" y="380" font-family="Inter, system-ui, sans-serif" font-size="108" font-weight="800" letter-spacing="-2" fill="#6b9e50">Trails</text>

      <!-- Tagline -->
      <text x="800" y="430" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="500" fill="#c8b890" text-anchor="middle" opacity="0.9">The Rails API, in TypeScript.</text>
    </svg>

    <!-- CTA buttons overlaid at bottom of hero -->
    <div class="hero-cta absolute bottom-8 left-0 right-0 z-10 flex justify-center gap-4">
      <a href="/frontiers" class="rounded-lg px-6 py-3 font-medium text-sm" style="background: #6b9e50; color: #1c1916; font-family: var(--font-sans);">
        Open Frontiers
      </a>
      <a href="#packages" class="rounded-lg border px-6 py-3 font-medium text-sm" style="border-color: #8a7a60; color: #e4ded4; font-family: var(--font-sans);">
        View Packages
      </a>
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
