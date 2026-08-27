#!/usr/bin/env bash
set -euo pipefail

root="${1:-.}"
pattern='javis[-_ ]?os|ArtyormSatori/javis'
targets=()

for dir in src crates apps frontend desktop packaging systemd deploy scripts; do
  [[ -d "$root/$dir" ]] && targets+=("$root/$dir")
done

for file in Cargo.toml Cargo.lock package.json package-lock.json pnpm-lock.yaml yarn.lock pyproject.toml requirements.txt; do
  [[ -f "$root/$file" ]] && targets+=("$root/$file")
done

if ((${#targets[@]} == 0)); then
  echo "TAVIS_REFERENCE_ONLY_GUARD_OK"
  exit 0
fi

set +e
matches="$(grep -RIniE \
  --exclude='*.md' \
  --exclude='tavis-reference-only-guard.sh' \
  --exclude-dir=tests \
  --exclude-dir=docs \
  --exclude-dir=target \
  --exclude-dir=.git \
  "$pattern" "${targets[@]}" 2>/dev/null)"
status=$?
set -e

if [[ $status -eq 0 ]]; then
  echo "TAVIS_REFERENCE_ONLY_VIOLATION" >&2
  printf '%s\n' "$matches" >&2
  exit 1
fi
if [[ $status -ne 1 ]]; then
  echo "TAVIS_REFERENCE_ONLY_GUARD_ERROR: grep exit $status" >&2
  exit "$status"
fi

echo "TAVIS_REFERENCE_ONLY_GUARD_OK"
