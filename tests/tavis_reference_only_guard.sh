#!/usr/bin/env bash
set -euo pipefail

GUARD="scripts/remediation/tavis-reference-only-guard.sh"
if [[ ! -x "$GUARD" ]]; then
  echo "TAVIS_REFERENCE_GUARD_MISSING: $GUARD" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/src" "$tmp/docs"
printf 'pub fn ok() {}\n' > "$tmp/src/lib.rs"
printf 'Reference docs may mention javis-os.\n' > "$tmp/docs/reference.md"

"$GUARD" "$tmp"

printf 'dependency = "https://github.com/ArtyormSatori/javis-os"\n' > "$tmp/src/forbidden.rs"
if "$GUARD" "$tmp"; then
  echo "TAVIS_REFERENCE_GUARD_FAILED_OPEN" >&2
  exit 1
fi

echo "TAVIS_REFERENCE_ONLY_GUARD_OK"
