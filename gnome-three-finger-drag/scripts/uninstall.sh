#!/bin/sh
set -eu

uuid='three-finger-drag@example.local'
data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}

gnome-extensions disable "$uuid" 2>/dev/null || true
systemctl --user stop gnome-three-finger-drag.service 2>/dev/null || true
rm -f "$HOME/.local/bin/gnome-three-finger-drag"
rm -f "$data_home/systemd/user/gnome-three-finger-drag.service"
rm -rf "$data_home/gnome-shell/extensions/$uuid"
systemctl --user daemon-reload

printf 'User files removed. To remove device permissions, run:\n'
printf '  sudo rm /etc/udev/rules.d/70-gnome-three-finger-drag.rules\n'
printf '  sudo udevadm control --reload-rules\n'
