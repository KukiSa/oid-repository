#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_TARGETS_FILE:?DEPLOY_TARGETS_FILE is required}"
: "${REMOTE_ARCHIVE:?REMOTE_ARCHIVE is required}"
: "${SITE_ARCHIVE:?SITE_ARCHIVE is required}"
: "${SSH_KEY_FILE:?SSH_KEY_FILE is required}"
: "${SSH_KNOWN_HOSTS_FILE:?SSH_KNOWN_HOSTS_FILE is required}"

while IFS=$'\t' read -r target_name deploy_host deploy_port deploy_user deploy_path; do
  echo "Deploying target: $target_name"
  scp_host="$deploy_host"
  if [[ "$deploy_host" == *:* ]]; then
    scp_host="[$deploy_host]"
  fi

  scp \
    -i "$SSH_KEY_FILE" \
    -P "$deploy_port" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$SSH_KNOWN_HOSTS_FILE" \
    "$SITE_ARCHIVE" \
    "$deploy_user@$scp_host:$REMOTE_ARCHIVE"

  remote_deploy_path="$(printf '%q' "$deploy_path")"
  remote_archive="$(printf '%q' "$REMOTE_ARCHIVE")"
  ssh \
    -i "$SSH_KEY_FILE" \
    -p "$deploy_port" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$SSH_KNOWN_HOSTS_FILE" \
    "$deploy_user@$deploy_host" \
    "DEPLOY_PATH=$remote_deploy_path REMOTE_ARCHIVE=$remote_archive bash -se" \
    < scripts/deploy/remote-deploy.sh
done < <(
  node -e '
    const fs = require("node:fs");
    const targets = JSON.parse(
      fs.readFileSync(process.env.DEPLOY_TARGETS_FILE, "utf8"),
    );
    for (const target of targets) {
      console.log(
        [target.name, target.host, target.port, target.user, target.path].join("\t"),
      );
    }
  '
)
