# Frontiers Roadmap

## P0 — Ship blockers — DONE

- [x] Break up the Frontiers page into components (16 components, page ~550 lines)
- [x] Login/logout UI (AuthButton, magic link flow, session in localStorage)
- [x] Wire auth to share client (auth-client.ts, fetchWithAuth)
- [x] Magic link verify redirect (302 to /frontiers?session=TOKEN)
- [x] Rate limit magic link requests (1/min/email)
- [x] Confirmation dialogs for destructive actions (ConfirmDialog)

## P1 — Reliability — DONE

- [x] Real TypeScript transpilation (Monaco TS worker -> \_vfs_compiled -> SW)
- [x] Error capture in Preview iframe (postMessage injection)
- [x] IndexedDB storage quota handling (QuotaExceededError, file export)
- [x] Service worker lifecycle (updatefound, skip-waiting, controllerchange)
- [x] Blob-based preview fallback for non-HTTPS (preview-server.ts)
- [x] Tests: 221 across 14 files covering all modules

## P2 — UX polish — DONE

- [x] Resizable panels (svelte-splitpanes)
- [x] File switcher Ctrl+P (fuzzy find)
- [x] Command palette Ctrl+Shift+P (17 commands)
- [x] Monaco type definitions from BlazeTrails source (generate-dts.js)
- [x] Better results display (auto-detect array-of-objects -> table)
- [x] Tab bar for open files
- [x] Dark/light theme toggle (earth tones, WCAG AA accessible)

## P3 — Features — DONE

- [x] `trails new` — full app scaffold (index.html, routes, controllers, seeds)
- [x] `generate migration` / `generate model` / `scaffold` — mirrors real CLI generators
- [x] `g` alias for generate
- [x] CLI input in Tasks tab with command history (arrow up/down)
- [x] `trail new` templates (blank, blog, e-commerce, API)
- [x] Run multiple files in sequence (runAllInDir)
- [x] Auto-discovery of migration files (db:migrate loads from db/migrations/ automatically)
- [x] Import/export projects as .sqlite files
- [x] Fork a shared project
- [x] Version history (compressed snapshots, save/restore/delete)
- [x] Green/brown earth tone theme with water blue info color
- [x] Style guide (STYLEGUIDE.md)

## P4 — Infrastructure — TODO

- [ ] **Deploy the API server.** Fly.io or Railway with persistent volume for SQLite.
- [ ] **Plug in a real email sender.** Resend — one API call to send magic links.
- [ ] **CDN for static assets.** Monaco chunks are ~4MB, sql-wasm.wasm is ~660KB.
- [ ] **API rate limiting beyond magic links.** Per-IP throttle on project saves, max projects per user.
- [ ] **Monitoring.** Sentry for error tracking, uptime checks.
- [ ] **Dogfood the backend with BlazeTrails Rack.** Replace http.createServer with a Rack app using ActionController routing.
- [ ] **Custom domain.** frontiers.blazetrails.dev or similar.
- [ ] **E2E tests with Playwright.** Full flow: new -> scaffold -> migrate -> seed -> share -> open link.
