#!/usr/bin/env bash
# Install the vendored enable-3fg-drag shim for this GNOME-oriented package.
#
# Builds libenable-3fg-drag.so, installs it to /usr/lib, and wires it into the
# Wayland compositor via /etc/ld.so.preload (the "global" method). On KDE
# Plasma, a scoped systemd drop-in is used instead when that unit exists.
#
# Also removes leftovers from the previous uinput/helper-based implementation
# of this project, if present.
#
# Needs sudo. Activates after the next full log out / log in.
# Reverse with ./uninstall.sh.
#
# Upstream project: https://github.com/joaodriessen/enable-3fg-drag
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
soname="libenable-3fg-drag.so"
sofile="/usr/lib/$soname"
preload_file="/etc/ld.so.preload"
dropin_dir="$HOME/.config/systemd/user/plasma-kwin_wayland.service.d"
dropin="$dropin_dir/enable-3fg-drag.conf"
legacy_uuid='three-finger-drag@example.local'
data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}

method=""
while [ $# -gt 0 ]; do
	case "$1" in
	--method) method="$2"; shift 2 ;;
	--method=*) method="${1#*=}"; shift ;;
	*) echo "unknown argument: $1" >&2; exit 2 ;;
	esac
done

if [ -z "$method" ]; then
	if systemctl --user cat plasma-kwin_wayland.service >/dev/null 2>&1; then
		method="kwin"
	else
		method="global"
	fi
	echo "==> Auto-detected method: $method"
fi

ver="$(libinput --version 2>/dev/null || pkg-config --modversion libinput 2>/dev/null || true)"
ver="$(printf '%s' "$ver" | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1 || true)"
if [ -n "$ver" ] && [ "$(printf '%s\n1.28\n' "$ver" | sort -V | head -1)" != "1.28" ]; then
	echo "WARNING: libinput $ver is older than 1.28; native 3-finger drag" >&2
	echo "         may be unavailable. 1.31+ is recommended (adds fast-swipe)." >&2
fi

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
systemctl --user daemon-reload 2>/dev/null || true

echo "==> Building the shim"
make -C "$here" clean >/dev/null
make -C "$here"

echo "==> Installing $sofile (mode 4755)"
sudo install -m 4755 -o root -g root "$here/$soname" "$sofile"
sudo ldconfig

case "$method" in
kwin)
	echo "==> Writing systemd drop-in (scoped to KWin only)"
	mkdir -p "$dropin_dir"
	cat >"$dropin" <<EOF
# Preload enable-3fg-drag into KWin only. Bare soname (not a path) so KWin's
# secure-execution loader honours it. See https://github.com/joaodriessen/enable-3fg-drag
[Service]
Environment=LD_PRELOAD=$soname
EOF
	systemctl --user daemon-reload
	;;
global)
	echo "==> Adding $sofile to $preload_file"
	if ! sudo grep -qxF "$sofile" "$preload_file" 2>/dev/null; then
		echo "$sofile" | sudo tee -a "$preload_file" >/dev/null
	fi
	;;
*)
	echo "unknown method: $method (use kwin or global)" >&2
	exit 2
	;;
esac

cat <<EOF

==> Installed (method: $method).

   Log out and back in (a full session restart) to activate.
   Then three fingers DRAG; a fast three-finger flick can still swipe
   (Overview / workspaces). Four-finger gestures keep working.

   This package vendors Joao Driessen's enable-3fg-drag shim:
   https://github.com/joaodriessen/enable-3fg-drag

   Verify it engaged:
EOF
if [ "$method" = kwin ]; then
	echo "     journalctl --user -u plasma-kwin_wayland -b | grep enable-3fg-drag"
else
	echo "     journalctl --user -b | grep enable-3fg-drag"
fi
echo "     # -> [enable-3fg-drag] enabled 3-finger drag on \"<device>\": Success"
echo
echo "   Revert:  ./uninstall.sh   (then log out/in)"
