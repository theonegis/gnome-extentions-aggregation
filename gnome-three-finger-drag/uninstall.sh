#!/usr/bin/env bash
# Fully revert install.sh. Removes the systemd drop-in, the
# /etc/ld.so.preload entry, the installed library, and leftovers from the
# previous uinput/helper-based implementation of this project.
# Takes effect on next log out / log in. Needs sudo.
set -euo pipefail

soname="libenable-3fg-drag.so"
sofile="/usr/lib/$soname"
preload_file="/etc/ld.so.preload"
dropin_dir="$HOME/.config/systemd/user/plasma-kwin_wayland.service.d"
dropin="$dropin_dir/enable-3fg-drag.conf"
legacy_uuid='three-finger-drag@example.local'
data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}

echo "==> Removing legacy gnome-three-finger-drag helper/extension, if present"
gnome-extensions disable "$legacy_uuid" 2>/dev/null || true
systemctl --user stop gnome-three-finger-drag.service 2>/dev/null || true
rm -f "$HOME/.local/bin/gnome-three-finger-drag"
rm -f "$data_home/systemd/user/gnome-three-finger-drag.service"
rm -rf "$data_home/gnome-shell/extensions/$legacy_uuid"
if [ -f /etc/udev/rules.d/70-gnome-three-finger-drag.rules ]; then
	sudo rm -f /etc/udev/rules.d/70-gnome-three-finger-drag.rules
	sudo udevadm control --reload-rules || true
fi

echo "==> Removing systemd drop-in (kwin method), if present"
if [ -f "$dropin" ]; then
	rm -f "$dropin"
	rmdir "$dropin_dir" 2>/dev/null || true
	systemctl --user daemon-reload 2>/dev/null || true
fi

echo "==> Removing $preload_file entry (global method), if present"
if [ -f "$preload_file" ] && grep -qxF "$sofile" "$preload_file" 2>/dev/null; then
	sudo grep -vxF "$sofile" "$preload_file" | sudo tee "$preload_file.tmp" >/dev/null
	sudo mv "$preload_file.tmp" "$preload_file"
fi

echo "==> Removing $sofile"
sudo rm -f "$sofile"
sudo ldconfig
systemctl --user daemon-reload 2>/dev/null || true

cat <<'EOF'

==> Reverted. Log out and back in to fully unload the shim.
EOF
