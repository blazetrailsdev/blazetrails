#!/usr/bin/env bash
# Driver for `pnpm api:compare`. Forwards any extra args ("$@") to
# compare.ts so flags like `--package`, `--privates`, `--files`,
# `--json` reach the comparison step. The fetch / extract / manifest
# steps don't take args.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

bash "$DIR/fetch-rails.sh"
ruby "$DIR/extract-ruby-api.rb"
pnpm tsx "$DIR/extract-ts-api.ts"
pnpm tsx "$DIR/compare.ts" "$@"
pnpm tsx "$ROOT/scripts/build-rails-privates-manifest.ts"
