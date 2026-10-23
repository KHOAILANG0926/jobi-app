#!/bin/sh
# 2026-10-23: bootstrap runner files through an already authenticated VPS console.
# Does not register/start a runner, read credentials, enable cron, or change the app.
set -eu
[ "$(id -u)" -eq 0 ] || { echo 'Run in the existing root VNC console.' >&2; exit 1; }
[ "$(uname -m)" = x86_64 ] || { echo 'Linux x64 required.' >&2; exit 1; }
for cmd in curl sha256sum tar runuser useradd; do
  command -v "$cmd" >/dev/null || { echo "Missing command: $cmd" >&2; exit 1; }
done
runner_user=crawler-runner
runner_dir=/home/crawler-runner/actions-runner
if ! id "$runner_user" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$runner_user"
fi
[ "$(id -u "$runner_user")" -ne 0 ] || exit 1
[ "$(getent passwd "$runner_user" | cut -d: -f6)" = /home/crawler-runner ] || {
  echo 'Unexpected home directory; stopped.' >&2; exit 1;
}
if [ -e "$runner_dir" ] || [ -L "$runner_dir" ]; then
  echo 'Runner directory already exists; left unchanged.'
  exit 0
fi
runner_tmp=$(mktemp -d)
trap 'rm -rf "$runner_tmp"' EXIT HUP INT TERM
curl --fail --location --retry 2 --connect-timeout 15 --max-time 300 \
  -o "$runner_tmp/runner.tar.gz" \
  https://github.com/actions/runner/releases/download/v2.338.0/actions-runner-linux-x64-2.338.0.tar.gz
printf '%s  %s\n' af4b794c1bc41d73d40535e3fe092a39f9679cd8d965954c2aca25a05ca41d32 "$runner_tmp/runner.tar.gz" | sha256sum -c -
chmod 755 "$runner_tmp"
chmod 644 "$runner_tmp/runner.tar.gz"
runuser -u "$runner_user" -- mkdir -m 700 "$runner_dir"
runuser -u "$runner_user" -- tar xzf "$runner_tmp/runner.tar.gz" -C "$runner_dir"
echo 'Runner files installed. NOT registered or running. No password needed.'
