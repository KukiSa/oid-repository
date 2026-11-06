#!/usr/bin/env bash
set -euo pipefail

case "$DEPLOY_PATH" in
  ""|"/"|"/."|"/.."|"/bin"|"/boot"|"/dev"|"/etc"|"/home"|"/lib"|"/lib64"|"/opt"|"/proc"|"/root"|"/run"|"/sbin"|"/srv"|"/sys"|"/tmp"|"/usr"|"/var")
    echo "Refusing unsafe deploy path: $DEPLOY_PATH" >&2
    exit 1
    ;;
esac

if [[ "$DEPLOY_PATH" != /* ]]; then
  echo "Deploy path must be absolute: $DEPLOY_PATH" >&2
  exit 1
fi
if [[ ! -f "$REMOTE_ARCHIVE" ]]; then
  echo "Archive not found: $REMOTE_ARCHIVE" >&2
  exit 1
fi

trap 'rm -f -- "$REMOTE_ARCHIVE"' EXIT
zstd -t "$REMOTE_ARCHIVE"
zstd -dc "$REMOTE_ARCHIVE" | tar -tf - >/dev/null
mkdir -p "$DEPLOY_PATH"

(
  flock 9
  find "$DEPLOY_PATH" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  zstd -dc "$REMOTE_ARCHIVE" | tar -xf - -C "$DEPLOY_PATH"
) 9>/tmp/oid-repository-deploy.lock
