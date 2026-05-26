#!/usr/bin/env bash
# Phase G candidate classifier
# Identifies which D-1-bypass test files could benefit from combined
# Phase G (useFixtures adoption) + D-1 (bypass removal) conversion.
#
# Usage: ./scripts/phase-g-hunt/classify.sh
#
# Outputs a TSV with: file, LOC, bypass_sites, inline_classes, canonical_pct, has_creates
set -euo pipefail

AR_SRC="packages/activerecord/src"

# Build canonical class name list from model filenames (kebab → PascalCase)
canonical_classes=$(
  ls "$AR_SRC/test-helpers/models/"*.ts 2>/dev/null \
    | xargs -I{} basename {} .ts \
    | sed -r 's/(^|-)(\w)/\U\2/g' \
    | sort -u
)

echo -e "file\tLOC\tsites\ttotal_classes\tcanonical_pct\thas_creates\tnon_canonical"

grep -rl "this\.adapter = adapter" "$AR_SRC" --include="*.test.ts" 2>/dev/null \
  | sed "s|^$AR_SRC/||" \
  | sort \
  | while IFS= read -r file; do
    full="$AR_SRC/$file"
    loc=$(wc -l < "$full")
    sites=$(grep -c "this\.adapter = adapter" "$full" || true)
    classes=$(grep -oP 'class \K\w+(?=\s+extends\s+(Base|ApplicationRecord|Model))' "$full" 2>/dev/null | sort -u || true)
    total=0
    if [ -n "$classes" ]; then
      total=$(echo "$classes" | grep -c . 2>/dev/null || echo 0)
    fi

    canonical=0
    non_canonical=""
    for cls in $classes; do
      if echo "$canonical_classes" | grep -qx "$cls"; then
        canonical=$((canonical + 1))
      else
        non_canonical="${non_canonical:+$non_canonical|}$cls"
      fi
    done

    pct=0
    if [ "$total" -gt 0 ]; then
      pct=$((canonical * 100 / total))
    fi

    creates=$(grep -cE '\.(create|save|insert)\b' "$full" 2>/dev/null || echo 0)
    has_creates="no"
    if [ "$creates" -gt 0 ]; then
      has_creates="yes($creates)"
    fi

    echo -e "$file\t$loc\t$sites\t$total\t${pct}%\t$has_creates\t${non_canonical:--}"
  done
