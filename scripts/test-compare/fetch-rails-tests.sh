#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAILS_DIR="$SCRIPT_DIR/../api-compare/.rails-source"
RAILS_TAG="v8.0.2"

if [ ! -d "$RAILS_DIR/.git" ]; then
  echo "Rails source not found at $RAILS_DIR — run api-compare/fetch-rails.sh first."
  exit 1
fi

echo "Expanding sparse checkout to include test directories..."

cd "$RAILS_DIR"

git sparse-checkout add \
  activerecord/test/cases/arel \
  activemodel/test/cases \
  activerecord/test/cases

echo "Rails test source ready at $RAILS_DIR"

# Quick check that test dirs exist
for dir in "activerecord/test/cases/arel" "activemodel/test/cases" "activerecord/test/cases"; do
  if [ -d "$dir" ]; then
    count=$(find "$dir" -name "*_test.rb" -o -name "test_*.rb" | wc -l)
    echo "  $dir: $count test files"
  else
    echo "  WARNING: $dir not found"
  fi
done
