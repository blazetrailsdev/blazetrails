# GitHub Actions self-hosted runner — Dokku deployment

Ephemeral runner image. Each container picks up one CI job, then exits.
Dokku restarts it. Scale with `dokku ps:scale gh-runner runner=N`.

Used by `.github/workflows/ci.yml` for the trust-gated pure-Node job set
(`build-and-typecheck`, `lint`, `prettier`, `guides-typecheck`,
`dx-type-tests`, `virtualized-dx-type-tests`, `unit-tests`, `website`).

Adapter tests, parity jobs, and `rails-comparison` stay on `ubuntu-latest`
because this image deliberately does **not** include Docker — keeping the
attack surface and image size small.

## One-time setup on the Dokku host

```bash
# 1. Create the app
dokku apps:create gh-runner

# 2. Wire credentials
#    GH_PAT needs `repo` scope (classic) OR a fine-grained PAT with
#    Administration: write on this single repo. Rotate periodically.
dokku config:set gh-runner \
  GH_REPO=blazetrailsdev/trails \
  GH_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  RUNNER_LABELS=self-hosted,Linux,X64

# 3. Persistent pnpm store across ephemeral lifetimes (CAS-safe for
#    concurrent replicas; node_modules and dist are NOT shared).
sudo mkdir -p /var/lib/dokku/data/storage/gh-runner-pnpm
sudo chown 1000:1000 /var/lib/dokku/data/storage/gh-runner-pnpm
dokku storage:mount gh-runner /var/lib/dokku/data/storage/gh-runner-pnpm:/home/runner/.local/share/pnpm
```

## Build + deploy

The Dockerfile lives in `infra/runner/`. Use `dokku git:from-image` after
building locally, or wire a `dokku-monorepo`-style buildpack root.

```bash
# From repo root, on a machine with Docker:
docker build -t gh-runner:latest infra/runner/
docker save gh-runner:latest | ssh dokku@DOKKU_HOST docker load
ssh dokku@DOKKU_HOST dokku git:from-image gh-runner gh-runner:latest

# Scale to N parallel runners
ssh dokku@DOKKU_HOST dokku ps:scale gh-runner runner=4
```

## Verify

```bash
gh api repos/blazetrailsdev/trails/actions/runners \
  --jq '.runners[] | {name, status, labels: [.labels[].name]}'
```

Expect N online runners with names like `gh-runner-runner-1-<timestamp>`.
Each disappears after running a job; a fresh entry replaces it on the
next container start.

## Updating the runner version

Bump `RUNNER_VERSION` in the Dockerfile and rebuild. GitHub deprecates
older runner versions on a rolling schedule; check
[releases](https://github.com/actions/runner/releases) quarterly.

## Tearing down old non-Dokku runners

After Dokku replicas are healthy, deregister any leftover hand-registered
runners (e.g. tmux-based `duodeca`, `duodeca-2`):

```bash
gh api repos/blazetrailsdev/trails/actions/runners \
  --jq '.runners[] | select(.name | test("^duodeca")) | .id' \
  | xargs -I{} gh api -X DELETE repos/blazetrailsdev/trails/actions/runners/{}
```
