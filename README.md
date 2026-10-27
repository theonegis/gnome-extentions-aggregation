# GNOME Extensions

这是一组用于 GNOME 的扩展与相关工具，放在同一个仓库里维护。多数是 GNOME Shell 扩展；三指拖动改为安装 libinput 原生能力的 shim。

| 目录 | 名称 | 作用 |
| --- | --- | --- |
| [gnome-move-cursor-among-monitors](gnome-move-cursor-among-monitors) | Move Cursor Among Monitors | 用方向快捷键把光标移到相邻屏幕中心 |
| [gnome-three-finger-drag](gnome-three-finger-drag) | Three Finger Drag | 打开 libinput 原生三指拖拽（vendored [enable-3fg-drag](https://github.com/joaodriessen/enable-3fg-drag)） |
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

打开 libinput 自带的三指拖拽（需 libinput ≥ 1.28，建议 ≥ 1.31）。慢速三指移动会拖动指针下的内容；快速三指轻扫仍可留给 Overview / 工作区。不再使用自定义 uinput helper，也不再拦截 GNOME 的三指手势。

实现来自 Joao Driessen 的 [enable-3fg-drag](https://github.com/joaodriessen/enable-3fg-drag)（MIT），本仓库 vendored 了该 shim。Fedora 上可先安装：

```sh
sudo dnf install git gcc make pkgconf-pkg-config libinput-devel
```

然后：

```sh
cd gnome-three-finger-drag
./install.sh
```

脚本会用 sudo 安装 `/usr/lib/libenable-3fg-drag.so`，并在 GNOME 上写入 `/etc/ld.so.preload`。注销并重新登录后生效。说明与卸载见该目录下的 [README](gnome-three-finger-drag/README.md)。

## Topbar Running Apps Indicator

在顶栏左侧显示正在运行的应用，每个应用一个图标。点击图标会切到该应用最近使用的窗口；如果这个应用已经在前台并且开了多个窗口，再点一次会在这些窗口之间轮换。

图标大小默认 18 像素，图标间距默认 14 像素。设置里还有一个「黑白图标」开关，打开后所有应用图标都会去掉颜色，用来和顶栏上的其他图标保持一致。默认是彩色。

```sh
cd gnome-topbar-running-apps
glib-compile-schemas schemas
gnome-extensions pack --force
gnome-extensions install --force topbar-running-apps-indicator@tanzhenyu.shell-extension.zip
gnome-extensions enable topbar-running-apps-indicator@tanzhenyu
```

这个目录目前没有单独的许可证文件。
