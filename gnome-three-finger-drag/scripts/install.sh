#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(dirname -- "$script_dir")
cd "$project_dir"

sudo install -m 0644 udev/70-gnome-three-finger-drag.rules \
    /etc/udev/rules.d/70-gnome-three-finger-drag.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=input
sudo udevadm trigger --subsystem-match=misc

if [ -d build ]; then
    meson setup --reconfigure build --prefix="$HOME/.local"
else
    meson setup build --prefix="$HOME/.local" --buildtype=release
fi
meson compile -C build
meson test -C build --print-errorlogs
meson install -C build
"$script_dir/install-extension.sh"
systemctl --user daemon-reload

printf '\nInstallation complete. Log out and back in once, then enable the extension.\n'
