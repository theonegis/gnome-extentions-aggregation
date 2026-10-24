import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {createTranslator} from '../i18n.js';
import {ShortcutConflicts, normalizeAccelerator} from '../conflicts.js';

function assert(value, message) {
    if (!value)
        throw new Error(message);
}
function drain() {
    const context = GLib.MainContext.default();
    while (context.pending())
        context.iteration(false);
}
for (const locale of ['zh_CN.UTF-8', 'zh_TW', 'zh-Hans', 'zh'])
    assert(createTranslator([locale])('Cancel') === '取消', `Chinese: ${locale}`);
for (const locale of ['en_US.UTF-8', 'de_DE', 'C', 'ja_JP'])
    assert(createTranslator([locale, 'zh_CN'])('Cancel') === 'Cancel', `English fallback: ${locale}`);
assert(createTranslator(['zh_CN'])('Conflicts with: {0}', 'Test').includes('Test'), 'Interpolation');
assert(normalizeAccelerator('<Super><Control>Left') === normalizeAccelerator('<Ctrl><Super>Left'), 'Modifier aliases/order');
assert(normalizeAccelerator('') === null, 'Empty binding');
let updates = 0;
const checker = new ShortcutConflicts(() => updates++);
const wm = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.keybindings'});
wm.set_strv('switch-to-workspace-left', ['<Super><Control>Left']);
drain();
assert(checker.find('<Control><Super>Left').some(c => c.key === 'switch-to-workspace-left'), 'Detect changed WM binding');
wm.set_strv('switch-to-workspace-left', []);
drain();
assert(!checker.find('<Super><Control>Left').some(c => c.key === 'switch-to-workspace-left'), 'Clear stale conflict');
const shell = new Gio.Settings({schema_id: 'org.gnome.shell.keybindings'});
shell.set_strv('toggle-overview', ['<Super><Control>F11']);
assert(checker.find('<Control><Super>F11').some(c => c.key === 'toggle-overview'), 'Shell binding');
const media = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.media-keys'});
const path = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/cursor-test/';
const custom = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding', path});
custom.set_string('name', 'Test custom shortcut');
custom.set_string('binding', '<Super><Control>F12');
media.set_strv('custom-keybindings', [path]);
drain();
assert(checker.find('<Control><Super>F12').some(c => c.label === 'Test custom shortcut'), 'Dynamically added custom shortcut');
custom.set_string('binding', '<Super><Control>F10');
drain();
assert(!checker.find('<Super><Control>F12').some(c => c.label === 'Test custom shortcut'), 'Changed custom shortcut');
assert(checker.find('<Super><Control>F10').some(c => c.label === 'Test custom shortcut'), 'New custom combination');
media.set_strv('custom-keybindings', []);
drain();
assert(!checker.find('<Super><Control>F10').some(c => c.label === 'Test custom shortcut'), 'Removed custom shortcut');
assert(updates > 0, 'Change notifications');
checker.destroy();
const before = updates;
wm.set_strv('switch-to-workspace-left', ['<Super><Control>Left']);
drain();
assert(updates === before, 'Signal cleanup');
print('PASS: Chinese/English selection, accelerator normalization, live system/custom conflicts and cleanup');
