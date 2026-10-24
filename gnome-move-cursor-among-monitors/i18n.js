// Select the preferred UI language, not a secondary fallback in LANGUAGE.
export function createTranslator(languageNames) {
    const chinese = /^zh(?:[_\-.@]|$)/i.test(languageNames[0] ?? '');
    return (english, ...args) => {
        const message = chinese ? (ZH[english] ?? english) : english;
        return message.replace(/\{(\d+)\}/g, (_match, index) => args[Number(index)] ?? '');
    };
}

const ZH = {
    'Move Cursor Among Monitors': '屏幕间移动光标',
    'Directional shortcuts': '方向快捷键',
    'Move to the center of the neighboring monitor in your display layout. If there is no neighbor in that direction, the pointer stays put.': '按显示设置中的屏幕排列移动到相邻屏幕中心。该方向没有相邻屏幕时，光标留在原处。',
    'Move to the left monitor': '移到左侧屏幕',
    'Move to the right monitor': '移到右侧屏幕',
    'Move to the monitor above': '移到上方屏幕',
    'Move to the monitor below': '移到下方屏幕',
    'Not set': '未设置',
    'Restore default shortcuts': '恢复默认快捷键',
    'Shortcut conflicts': '快捷键冲突',
    'No conflicts found in the checked GNOME shortcuts.': '未发现与已检查的 GNOME 快捷键冲突。',
    'Conflicting shortcuts are marked below each direction. Choose another combination.': '冲突的快捷键已在对应方向下方标出，请选择其他组合。',
    'Conflicts with: {0}': '与以下快捷键冲突：{0}',
    'Already used for “{0}”. Choose another combination or press Esc to cancel.': '此快捷键已用于“{0}”。请按其他组合，或按 Esc 取消。',
    'This shortcut conflicts with {0}. Choose another combination or press Esc to cancel.': '此快捷键与 {0} 冲突。请按其他组合，或按 Esc 取消。',
    'Press a new shortcut\nEsc to cancel · Backspace to clear': '请按新的快捷键\nEsc 取消 · Backspace 清除',
    'Include Ctrl, Alt, or Super in the shortcut.': '快捷键需包含 Ctrl、Alt 或 Super。',
    'Cancel': '取消',
    'Default: Super + Ctrl + arrow keys. Changes take effect immediately. Shortcuts are inactive on the lock screen.': '默认：Super + Ctrl + 方向键。修改后立即生效。锁屏时不生效。',
    'Checks GNOME window management, Shell, Mutter, media keys and custom keyboard shortcuts. Some shortcuts registered by other extensions or applications cannot be detected. System shortcuts are never modified.': '检查 GNOME 窗口管理、Shell、Mutter、媒体键和自定义键盘快捷键。其他扩展或应用自行注册的部分组合无法检测。不会修改系统快捷键。',
};
