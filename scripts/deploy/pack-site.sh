#!/usr/bin/env bash
set -euo pipefail
archive=${1:?absolute output archive path required}
[[ "$archive" = /*.tar.zst ]] || exit 2
test -f out/index.html
tar -C out -cf - . | zstd -T0 -3 -o "$archive"
