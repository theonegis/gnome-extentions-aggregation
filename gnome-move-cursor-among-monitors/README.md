# Move Cursor Among Monitors

GNOME Shell 50 扩展：按方向快捷键，将鼠标光标移到相邻屏幕的中心。

| 默认快捷键 | 动作 |
| --- | --- |
| Super + Ctrl + Left | 左侧相邻屏幕 |
| Super + Ctrl + Right | 右侧相邻屏幕 |
| Super + Ctrl + Up | 上方相邻屏幕 |
| Super + Ctrl + Down | 下方相邻屏幕 |

“当前屏幕”指光标所在屏幕，不是键盘焦点窗口所在屏幕。方向遵循 GNOME
显示设置中的排列；使用 Mutter 的原生相邻屏幕判定。单屏、镜像显示、该方向
没有邻居时不移动，不循环绕回，也不把纯对角屏幕当作上下左右邻居。
按住快捷键不会连续跳过多块屏幕。桌面和概览中可用，锁屏中不可用。
扩展不主动切换窗口焦点；如果用户启用了“焦点跟随鼠标”，窗口焦点可能随光标变化。

## 本地安装

依赖：GNOME Shell 50、GJS、GLib schema 工具、make、unzip。
Fedora 开发环境通常已包含这些组件。

```sh
git clone https://github.com/theonegis/gnome-extentions-aggregation.git
cd gnome-extentions-aggregation/gnome-move-cursor-among-monitors
make install
```

首次安装后如果 GNOME 尚未发现扩展，注销并重新登录，再运行：

```sh
gnome-extensions enable move-cursor-among-monitors@tanzhenyu
gnome-extensions prefs move-cursor-among-monitors@tanzhenyu
```

默认使用 **Super+Ctrl+方向键**，避开 GNOME 默认的 Super+Alt 工作区组合。
如果此前手动保存过旧快捷键，升级不会覆盖用户配置；可点击“恢复默认快捷键”切换到新默认值。

设置窗口中点击方向右侧的快捷键，按下新的组合即可。组合需包含 Ctrl、Alt 或
Super 中至少一个；Esc 取消，Backspace 清除。可一键恢复默认值。
录制时如果与系统或本扩展的其他方向冲突，会显示具体冲突动作并等待重新输入，
不会保存该组合。已存在的冲突（包括外部命令修改的配置）会在对应方向下方显示提醒。

检测覆盖 GNOME 窗口管理、Shell、Mutter、媒体键和系统自定义快捷键，
并随系统快捷键变更实时更新；无法保证检测到其他扩展或应用动态注册的全部快捷键。
本扩展不再提供修改系统快捷键的按钮，冲突需通过选择其他组合来解决。

界面语言随系统首选语言自动选择：`zh_CN`、`zh_TW` 等中文语言环境显示中文，
其余语言环境显示英文。使用 GLib 的语言优先顺序（含 `LANGUAGE`/`LC_MESSAGES`/`LANG`）；
修改系统语言后重新打开设置窗口生效。

修改即时生效。无需 Input Remapper、后台服务、root 权限或 xdotool。

也可用命令配置（安装后，schema 使用本地路径）：

```sh
gsettings --schemadir "$HOME/.local/share/gnome-shell/extensions/move-cursor-among-monitors@tanzhenyu/schemas" \
  set org.gnome.shell.extensions.move-cursor-among-monitors move-cursor-right "['<Super><Control>Right']"
```

卸载：

```sh
gnome-extensions disable move-cursor-among-monitors@tanzhenyu
gnome-extensions uninstall move-cursor-among-monitors@tanzhenyu
```

## 开发与验证

`make check` 检查 schema 和坐标边界；`make pack` 生成并检查
`dist/move-cursor-among-monitors@tanzhenyu.shell-extension.zip`。
Shell 模块只能在 GNOME Shell 中运行，不能用 `gjs -m extension.js` 代替运行验证。
运行验证记录见 [docs/validation.md](docs/validation.md)。

源码：`extension.js` 为 Shell 快捷键和光标移动逻辑；`prefs.js` 为 GTK4/libadwaita
设置界面；`geometry.js` 负责坐标范围和中心计算；`i18n.js` 提供中英文本；
`conflicts.js` 负责只读的系统快捷键冲突检测。
详细原理见 [docs/how-it-works.md](docs/how-it-works.md)。

## 许可证

本项目使用 [GNU GPL v3](LICENSE) 许可证。
