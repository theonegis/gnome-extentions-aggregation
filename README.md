# GNOME Extensions

这是一组用于 GNOME Shell 50 的扩展，放在同一个仓库里维护。每个扩展仍是独立目录，可以单独安装、启用和卸载。

| 目录 | 扩展 | 作用 |
| --- | --- | --- |
| [gnome-move-cursor-among-monitors](gnome-move-cursor-among-monitors) | Move Cursor Among Monitors | 用方向快捷键把光标移到相邻屏幕中心 |
| [gnome-three-finger-drag](gnome-three-finger-drag) | Three Finger Drag | 在 Wayland 上用三指拖拽，接近 macOS 的触控板拖动 |
| [gnome-topbar-running-apps](gnome-topbar-running-apps) | Topbar Running Apps Indicator | 在顶栏显示正在运行的应用图标，点击切换到对应应用 |

```sh
git clone https://github.com/theonegis/gnome-extentions-aggregation.git
cd gnome-extentions-aggregation
```

首次安装某个扩展后，如果「扩展」应用里还看不到它，先注销并重新登录，再启用。

## Move Cursor Among Monitors

按方向快捷键，把鼠标光标移到相邻屏幕的中心。默认是 Super + Ctrl + 方向键。当前屏幕按光标所在屏幕计算，不循环绕回，锁屏中不可用。

依赖：GNOME Shell 50、GJS、GLib schema 工具、make、unzip。

```sh
cd gnome-move-cursor-among-monitors
make install
gnome-extensions enable move-cursor-among-monitors@tanzhenyu
```

设置、冲突检测和实现说明见该目录下的 [README](gnome-move-cursor-among-monitors/README.md)。许可证是 [GNU GPL v3](gnome-move-cursor-among-monitors/LICENSE)。

## Three Finger Drag

三指在触控板上移动时按住鼠标左键并移动指针。抬起手指后，按键默认还会保持 2 秒，方便在触控板边缘重新落指并继续拖动。扩展会拦住 GNOME 默认的三指滑动手势，实际拖拽由一个 libinput / uinput 辅助程序完成。

这个扩展需要编译原生辅助程序，并安装 udev 规则。Fedora 上可以先安装构建依赖：

```sh
sudo dnf install git gcc meson ninja-build pkgconf-pkg-config libinput-devel systemd-devel
```

然后：

```sh
cd gnome-three-finger-drag
./scripts/install.sh
```

安装脚本会用 sudo 写入 `/etc/udev/rules.d/`。辅助程序、用户服务和扩展装在当前用户的 `~/.local` 下。注销并重新登录后启用：

```sh
gnome-extensions enable three-finger-drag@example.local
```

设备权限、延迟时间和卸载步骤见该目录下的 [README](gnome-three-finger-drag/README.md)。许可证是 [Mozilla Public License 2.0](gnome-three-finger-drag/LICENSE)。

## Topbar Running Apps Indicator

在顶栏左侧显示正在运行的应用，每个应用一个图标。点击图标会切到该应用最近使用的窗口；如果这个应用已经在前台并且开了多个窗口，再点一次会在这些窗口之间轮换。

图标大小默认 18 像素，图标间距默认 14 像素，都可以在扩展设置里调整。

```sh
cd gnome-topbar-running-apps
glib-compile-schemas schemas
gnome-extensions pack --force
gnome-extensions install --force topbar-running-apps-indicator@tanzhenyu.shell-extension.zip
gnome-extensions enable topbar-running-apps-indicator@tanzhenyu
```

这个目录目前没有单独的许可证文件。
