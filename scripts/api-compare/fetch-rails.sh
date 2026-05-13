#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAILS_DIR="$SCRIPT_DIR/.rails-source"
RAILS_TAG="v8.0.2"

# Single source of truth for sparse-checkout paths. Used for both fresh clones
# and to re-sync existing mirrors when this script is re-run.
SPARSE_PATHS=(
  activerecord/lib/active_record
  activerecord/lib/arel
  activerecord/test/fixtures
  activerecord/test/models
  activerecord/test/schema
  activemodel/lib/active_model
  activesupport/lib/active_support
  actionpack/lib/action_dispatch
  actionpack/lib/action_controller
  actionview/lib/action_view
  railties/lib/rails
)

if [ -d "$RAILS_DIR/.git" ]; then
  # Existing mirror: re-apply sparse-checkout so paths added since the
  # original clone (e.g. test/fixtures, test/models) get populated without
  # a full re-clone. Idempotent when the patterns already match.
  echo "Rails source already cloned at $RAILS_DIR — syncing sparse-checkout."
  (cd "$RAILS_DIR" && git sparse-checkout set "${SPARSE_PATHS[@]}")
  echo "Rails source ready at $RAILS_DIR"
  exit 0
fi

echo "Cloning Rails $RAILS_TAG (sparse checkout)..."
rm -rf "$RAILS_DIR"

git clone \
  --filter=blob:none \
  --sparse \
  --depth=1 \
  --branch "$RAILS_TAG" \
  https://github.com/rails/rails.git \
  "$RAILS_DIR"

cd "$RAILS_DIR"

git sparse-checkout set "${SPARSE_PATHS[@]}"

echo "Rails source ready at $RAILS_DIR"
