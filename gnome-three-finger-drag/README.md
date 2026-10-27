# GNOME Three Finger Drag

macOS-style three-finger dragging for GNOME (and other Wayland desktops) by
turning on **libinput's built-in** three-finger drag.

Rest three fingers on the touchpad and move: the thing under the cursor is
dragged. Lift to drop. A *fast* three-finger flick can still be a swipe
(Overview / workspace switching on GNOME). Four-finger gestures keep working.

This directory no longer ships a custom uinput helper or a GNOME Shell
extension that blocks three-finger gestures. Drag is synthesised inside
libinput; the compositor just receives ordinary pointer button and motion
events.

## Upstream shim

The drag implementation is **[enable-3fg-drag](https://github.com/joaodriessen/enable-3fg-drag)**
by Joao Driessen (MIT).

`enable-3fg-drag.c`, `Makefile`, and `LICENSE` in this directory are that
project's shim, vendored here so this aggregation repo can install it for
GNOME users. Behaviour and the LD_PRELOAD approach are theirs; install /
uninstall wrappers below also remove leftovers from this project's older
helper-based design.

If your desktop ever gains a native toggle for libinput 3fg-drag, uninstall
this shim and use the real setting instead.

## Requirements

- **libinput ≥ 1.28** (≥ **1.31** recommended, for fast-swipe).
  Check with `libinput --version`.
- A **Wayland** session.
- A touchpad libinput recognises as supporting 3-finger drag.
- `gcc`/`clang`, `make`, and libinput development headers
  (Fedora: `libinput-devel`; Debian/Ubuntu: `libinput-dev`).

## Install

```sh
git clone https://github.com/theonegis/gnome-extentions-aggregation.git
cd gnome-extentions-aggregation/gnome-three-finger-drag
./install.sh
```

The script needs sudo: it installs `/usr/lib/libenable-3fg-drag.so` and, on
GNOME, adds it to `/etc/ld.so.preload`. On KDE Plasma it prefers a scoped
systemd drop-in for `plasma-kwin_wayland` instead. Override with
`./install.sh --method global` or `--method kwin`.

Then **log out and back in**. There is no Extensions app toggle anymore.

Verify:

```sh
journalctl --user -b | grep enable-3fg-drag
# -> [enable-3fg-drag] enabled 3-finger drag on "<your touchpad>": Success
```

## Uninstall

```sh
./uninstall.sh
```

Then log out and back in. This also removes the old helper binary, user
service, udev rule, and `three-finger-drag@example.local` extension if they
were still installed.

## How it works

libinput has shipped real three-finger dragging since v1.28
(`libinput_device_config_3fg_drag_set_enabled()`). The feature is disabled by
default and can only be enabled by the process that owns the libinput
context — the compositor. Mainstream desktops do not call that API yet.

The shim interposes `libinput_get_event()`. When the compositor's libinput
reports a newly added device that supports ≥ 3-finger drag, the shim enables
it and passes the event on. It does not reimplement drag, inject uinput
events, or block GNOME Shell gestures.

On libinput ≥ 1.31, a quick three-finger move can still be a swipe
(fast-swipe), so Overview and workspace gestures remain available for flicks.

## Why not a GNOME Shell extension?

Native 3fg-drag is configured inside the compositor's libinput context. A
Shell extension cannot flip that switch without reaching into the same
process (this shim uses `LD_PRELOAD`). Blocking Stage `TOUCHPAD_SWIPE` events
is also the wrong tool once libinput itself turns slow three-finger motion
into pointer drag and keeps fast flicks as swipes.

## License

- Shim (`enable-3fg-drag.c`, upstream `Makefile` content):
  [MIT](LICENSE) © Joao Driessen — see
  [enable-3fg-drag](https://github.com/joaodriessen/enable-3fg-drag).
- Install/uninstall wrappers in this directory: same MIT terms as the
  upstream project they adapt.
