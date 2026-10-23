#!/usr/bin/env bash
# 2026-10-23: open a private server browser in the existing AZDIGI console.
# No public port, SSH, root-password, cron, crawler, app or DB changes.
set -euo pipefail
export LC_ALL=C
mode=${1:---check}
case "$mode" in --check|--install) ;; *) echo 'Usage: bash browser-console.sh [--check|--install]' >&2; exit 2;; esac
[[ $# -le 1 ]] || exit 2
browser_user=jobi-browser
browser_home=/var/lib/jobi-browser
app_dir=/usr/local/lib/jobi-console-browser
unit=/etc/systemd/system/jobi-console-browser.service
fail() { echo "STOP: $*" >&2; exit 1; }
cleanup() {
  local result=$?
  trap - EXIT
  if [[ $result != 0 && ${launched:-false} == true ]]; then
    systemctl stop jobi-console-browser.service || true
    chvt 1 || true
    echo 'Browser stopped; return to existing tty1. Rerun the same installer to resume.' >&2
  fi
  if [[ -n ${work:-} ]]; then rm -rf -- "$work"; fi
  exit "$result"
}
if [[ $mode == --check ]]; then
  echo 'Read-only check; nothing will be installed or started.'
  uname -m
  free -m
  df -Pm / | tail -1
  for cmd in Xorg xinit openbox google-chrome-stable python3; do command -v "$cmd" || true; done
  if [[ -d /run/systemd/system ]]; then systemctl is-active jobi-console-browser.service || true; fi
  exit 0
fi
[[ $(id -u) == 0 ]] || fail 'Run from the existing root console.'
[[ $(uname -m) == x86_64 ]] || fail 'Only x86_64 is supported.'
[[ -d /run/systemd/system ]] || fail 'systemd is required.'
[[ -r /etc/os-release ]] || fail 'Cannot identify OS.'
. /etc/os-release
[[ ${ID:-} == ubuntu && ${VERSION_ID:-} == 22.04 ]] || fail 'This installer is limited to Ubuntu 22.04.'
[[ -e /dev/dri/card0 || -e /dev/fb0 ]] || fail 'No physical console graphics device.'
[[ ! -L $unit && ! -L $app_dir && ! -L $browser_home ]] || fail 'Unexpected symlink; leaving it unchanged.'
managed=false
if [[ -d $app_dir && -f $app_dir/OWNER && ! -L $app_dir/OWNER ]]; then
  if [[ $(stat -c '%u:%a' "$app_dir") == 0:755 && $(stat -c '%u' "$app_dir/OWNER") == 0 && $(cat "$app_dir/OWNER") == jobi-console-browser-v1 ]]; then managed=true; fi
fi
if [[ $managed != true ]]; then
  [[ ! -e $unit && ! -e $app_dir && ! -e $browser_home ]] || fail 'Unrecognized existing installation; leaving it unchanged.'
  if getent passwd "$browser_user" >/dev/null; then fail 'Browser account already exists; leaving it unchanged.'; fi
else
  if [[ -e $unit ]]; then grep -qx '# Managed by jobi-console-browser-v1' "$unit" || fail 'Unexpected service file.'; fi
  if getent passwd "$browser_user" >/dev/null; then
    [[ $(id -u "$browser_user") != 0 && $(getent passwd "$browser_user" | cut -d: -f6) == "$browser_home" ]] || fail 'Unexpected browser account.'
    [[ -d $browser_home && $(stat -c '%u' "$browser_home") == "$(id -u "$browser_user")" ]] || fail 'Unexpected browser home ownership.'
  elif [[ -e $browser_home ]]; then fail 'Unexpected browser home without account.'; fi
  systemctl is-active --quiet jobi-console-browser.service && fail 'Browser already running; leaving it unchanged.'
fi
[[ ! -e /tmp/.X0-lock && ! -S /tmp/.X11-unix/X0 ]] || fail 'Display :0 is already in use.'
[[ $(awk '/MemAvailable:/ {print $2}' /proc/meminfo) -ge 400000 ]] || fail 'Less than 400 MB available RAM.'
[[ $(df -Pk / | awk 'NR==2 {print $4}') -ge 1500000 ]] || fail 'Less than 1.5 GB free disk.'
for cmd in apt-get curl dpkg-deb runuser systemctl chvt; do command -v "$cmd" >/dev/null || fail "Missing $cmd"; done
work=$(mktemp -d /tmp/jobi-browser.XXXXXXXX)
launched=false
trap cleanup EXIT
chmod 755 "$work"
install -d -m 755 "$app_dir"
printf '%s\n' jobi-console-browser-v1 > "$app_dir/OWNER"
echo 'Installing console display tools and official Google Chrome.'
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends xserver-xorg-core xserver-xorg-video-fbdev xserver-xorg-input-libinput xinit xauth x11-utils openbox dbus-x11 fonts-liberation curl ca-certificates
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 --connect-timeout 15 --max-time 300 -o "$work/chrome.deb" https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
[[ $(dpkg-deb -f "$work/chrome.deb" Package) == google-chrome-stable ]] || fail 'Unexpected Chrome package.'
[[ $(dpkg-deb -f "$work/chrome.deb" Architecture) == amd64 ]] || fail 'Unexpected Chrome architecture.'
chmod 644 "$work/chrome.deb"
DEBIAN_FRONTEND=noninteractive apt-get install -y "$work/chrome.deb"
if ! getent passwd "$browser_user" >/dev/null; then useradd --system --create-home --home-dir "$browser_home" --shell /usr/sbin/nologin "$browser_user"; fi
chmod 700 "$browser_home"
cat > "$app_dir/client" <<'CLIENT'
#!/bin/sh
exec runuser -u jobi-browser -- env HOME=/var/lib/jobi-browser XAUTHORITY=/run/jobi-console-browser/Xauthority /usr/bin/dbus-run-session /usr/local/lib/jobi-console-browser/session
CLIENT
cat > "$app_dir/session" <<'SESSION'
#!/bin/sh
umask 077
/usr/bin/openbox &
exec /usr/bin/google-chrome-stable --user-data-dir=/var/lib/jobi-browser/profile --no-first-run --no-default-browser-check --disable-dev-shm-usage --start-maximized https://muaban.net
SESSION
cat > "$app_dir/start" <<'START'
#!/bin/bash
set -euo pipefail
umask 077
auth=/run/jobi-console-browser/Xauthority
install -m 600 -o jobi-browser -g jobi-browser /dev/null "$auth"
cookie=$(mcookie)
runuser -u jobi-browser -- xauth -f "$auth" add :0 . "$cookie"
unset cookie
export XAUTHORITY="$auth"
exec /usr/bin/xinit /usr/local/lib/jobi-console-browser/client -- /usr/lib/xorg/Xorg :0 vt7 -keeptty -nolisten tcp -auth "$auth"
START
chmod 755 "$app_dir/client" "$app_dir/session" "$app_dir/start"
cat > "$unit" <<'UNIT'
# Managed by jobi-console-browser-v1
[Unit]
Description=Jobi browser in existing VPS physical console
After=network-online.target
Wants=network-online.target
Conflicts=getty@tty7.service
[Service]
Type=simple
ExecStart=/usr/local/lib/jobi-console-browser/start
RuntimeDirectory=jobi-console-browser
RuntimeDirectoryMode=0755
StandardInput=tty
TTYPath=/dev/tty7
TTYReset=yes
TTYVHangup=yes
KillMode=control-group
TimeoutStopSec=20
Restart=no
UMask=0077
[Install]
WantedBy=multi-user.target
UNIT
systemd-analyze verify "$unit"
systemctl daemon-reload
launched=true
systemctl start jobi-console-browser.service
ready=false
for attempt in {1..30}; do
  if ! systemctl is-active --quiet jobi-console-browser.service; then break; fi
  if runuser -u "$browser_user" -- env DISPLAY=:0 XAUTHORITY=/run/jobi-console-browser/Xauthority xwininfo -root -tree 2>/dev/null | grep -q 'Google-chrome'; then ready=true; break; fi
  sleep 2
done
if [[ $ready != true ]]; then
  fail 'Chrome window not confirmed. Service stopped; existing tty1 console preserved. Inspect: journalctl -u jobi-console-browser -n 30'
fi
systemctl enable jobi-console-browser.service
echo 'Chrome window detected on tty7. Check the visible console and sign in to Muaban there.'
echo 'Login/profile stays on this VPS. No job collected or published by this script.'
echo 'Return to text console: Ctrl+Alt+F1. Stop browser: systemctl stop jobi-console-browser'
chvt 7
