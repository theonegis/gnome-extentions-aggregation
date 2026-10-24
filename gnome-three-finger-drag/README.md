# GNOME Three Finger Drag

macOS-style three-finger dragging for GNOME on Wayland. Move three fingers across
the touchpad to hold the left mouse button and move the pointer. After lifting
your fingers, the button stays pressed for 2 seconds by default. Start another
three-finger swipe within that time to continue the same drag, allowing you to
reposition your fingers when you reach the edge of the touchpad.

Developed and tested on Fedora 44 with GNOME Shell 50.4 and libinput 1.31.3.

## Release delay

Open the extension's preferences in Extension Manager, or run:

```sh
gnome-extensions prefs three-finger-drag@example.local
```

The release delay defaults to **2 seconds** and can be set from **0 to 10 seconds**
in 0.1-second increments. Set it to 0 to release immediately when the gesture ends.
Changes apply at the next gesture end without restarting the service or logging out.

When upgrading from a version without preferences, GNOME may still report that
the extension has no preferences. Log out and back in once to refresh that entry.
The updated helper's default delay takes effect as soon as the service restarts.

During the delay, moving one finger, tapping, or clicking the same touchpad
releases the button early. To resume the drag, start another three-finger swipe
without first moving the pointer with one finger.
Single-finger motion is detected in the helper's independent libinput context;
the compositor may process the first motion event before the button release.
Tap detection requires libinput tapping support. The helper does not forward tap
events, but the desktop's own tap-to-click events may still reach applications.
Disabling the extension, stopping the helper, removing the device, or cancelling
the gesture releases the button immediately.

Preferences are stored in `$XDG_CONFIG_HOME/gnome-three-finger-drag/release-delay-ms`
(or `~/.config/gnome-three-finger-drag/release-delay-ms` when unset), in milliseconds.
The helper's `--release-delay 2` command-line option overrides the file for debugging.

## How it works

The project consists of two cooperating components:

1. **GNOME Shell extension:** listens for Stage `TOUCHPAD_SWIPE` events and returns
   `Clutter.EVENT_STOP` when the finger count is three. This blocks GNOME's default
   overview/workspace gestures. Other finger counts pass through.
2. **Native helper:** reads touchpad gestures through an independent libinput
   context. On `SWIPE_BEGIN`, it sends `BTN_LEFT=1` through `/dev/uinput`.
   `SWIPE_UPDATE` converts libinput `dx/dy` into `REL_X/REL_Y` events. `SWIPE_END`
   starts a monotonic-clock timeout; expiry sends `BTN_LEFT=0`. A new
   `SWIPE_BEGIN` before expiry cancels the timeout and resumes the drag without
   pressing the button again. Shutdown signals also release the button.

The extension requests that the user systemd manager start the helper on enable
and stop it on disable. Disabling also disconnects gesture interception, restoring
GNOME's default gestures. Do not enable the helper as a separate autostart service.

```text
Touchpad --libinput--> helper --uinput--> virtual mouse (left button + motion)
   +------Clutter---> Shell extension --> blocks default three-finger swipe
```

## Compatibility and limitations

- The extension currently declares support for GNOME Shell 50.
- Intended for Wayland; X11 has not been tested.
- GNOME Shell gesture APIs are private and need verification after major upgrades.
- libinput emits swipe events only after recognizing a gesture, so this is an
  approximation of the macOS experience rather than an identical implementation.
- Some touchpad firmware may not produce reliable three-finger swipe events.

## Device permissions

The helper needs to read touchpad `/dev/input/event*` devices and write to
`/dev/uinput`. The supplied udev rules use systemd-logind's `uaccess` mechanism to
grant access to the active local session:

- Input access matches only event devices marked `ID_INPUT_TOUCHPAD=1`, without
  granting access to raw keyboard events.
- Access to uinput allows the user to create virtual input devices and inject
  input events. This permission is broader than this helper's mouse-only behavior.

Review [the udev rules](udev/70-gnome-three-finger-drag.rules) before installing.
Avoid adding your user to the `input` group, which usually also grants access to
raw keyboard events. The helper runs as your user, not as root.

## Build dependencies

Requires Meson 0.55 or newer, a C11 compiler, libinput 1.19 or newer, libudev,
and a GNOME desktop with user systemd services and systemd-logind.

Fedora:

```sh
sudo dnf install git gcc meson ninja-build pkgconf-pkg-config libinput-devel systemd-devel
```

Ubuntu/Debian (package names; GNOME Shell 50 is still required):

```sh
sudo apt install git build-essential meson ninja-build pkg-config libinput-dev libudev-dev
```

## Install

```sh
git clone https://github.com/theonegis/gnome-extentions-aggregation.git
cd gnome-extentions-aggregation/gnome-three-finger-drag
./scripts/install.sh
```

The script requests sudo to install and activate the udev rules in
`/etc/udev/rules.d/`. The helper, user service, and extension are installed under
your user's `~/.local` directory (the extension honors `XDG_DATA_HOME`).

After the first installation, log out and back in so GNOME discovers the extension,
then enable **Three Finger Drag** in the Extensions app or run:

```sh
gnome-extensions enable three-finger-drag@example.local
```

Normal enable/disable operations do not require logging out. Updating the Shell
extension's JavaScript may require a new session to load the new code.

## Manual build and installation

Run from the project directory:

```sh
# 1. Install and activate device permissions
sudo install -m 0644 udev/70-gnome-three-finger-drag.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=input
sudo udevadm trigger --subsystem-match=misc

# 2. Build, test, and install the helper and user service
meson setup build --prefix="$HOME/.local" --buildtype=release
meson compile -C build
meson test -C build --print-errorlogs
meson install -C build

# 3. Install the Shell extension and reload user service definitions
./scripts/install-extension.sh
systemctl --user daemon-reload
```

For an existing build directory, use `meson setup --reconfigure build` with the
same options. Log out and back in after installing the extension, then enable it.
Do not run `systemctl --user enable`: the extension manages the service lifecycle.
For temporary helper diagnostics:

```sh
systemctl --user start gnome-three-finger-drag.service
journalctl --user -u gnome-three-finger-drag.service -f
```

## Pointer speed

The default speed multiplier is `1.0`. Run
`systemctl --user edit gnome-three-finger-drag.service` and add:

```ini
[Service]
ExecStart=
ExecStart=%h/.local/bin/gnome-three-finger-drag --speed 1.35
```

Save, run `systemctl --user daemon-reload`, then disable and re-enable the
extension. The supported speed range is greater than 0 and up to 10.

## Verification and troubleshooting

```sh
gnome-extensions info three-finger-drag@example.local
systemctl --user status gnome-three-finger-drag.service
journalctl --user -u gnome-three-finger-drag.service -b
getfacl /dev/uinput
```

- With the extension enabled, the service should be `active (running)`.
- With the extension disabled, it should be `inactive (dead)` and GNOME's default
  three-finger gestures should work again.
- For `Permission denied`, check that the udev rules are installed and log in again.
- If `/dev/uinput` is missing, load the kernel module with `sudo modprobe uinput`.
- The libinput firmware warning `clickpad advertising right button` did not prevent
  gestures from working on the tested touchpad.

## Uninstall

```sh
./scripts/uninstall.sh
sudo rm /etc/udev/rules.d/70-gnome-three-finger-drag.rules
sudo udevadm control --reload-rules
```

The release-delay preference file is retained. To ensure previously granted device
ACLs are cleared after removing the rule, reboot before relying on permissions
having returned to their original state.

## License

[Mozilla Public License 2.0](LICENSE)
