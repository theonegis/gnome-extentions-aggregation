import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {createTranslator} from './i18n.js';
import {ShortcutConflicts, normalizeAccelerator} from './conflicts.js';

const ACTIONS = [
    ['left', 'Move to the left monitor'], ['right', 'Move to the right monitor'],
    ['up', 'Move to the monitor above'], ['down', 'Move to the monitor below'],
];

export default class MoveCursorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const t = createTranslator(GLib.get_language_names());
        window.set_title(t('Move Cursor Among Monitors'));
        window.set_default_size(680, 650);
        const page = new Adw.PreferencesPage({title: t('Move Cursor Among Monitors'),
            icon_name: 'input-mouse-symbolic'});
        const group = new Adw.PreferencesGroup({title: t('Directional shortcuts'),
            description: t('Move to the center of the neighboring monitor in your display layout. If there is no neighbor in that direction, the pointer stays put.')});
        page.add(group);
        window.add(page);
        const signals = [];
        const rows = new Map();
        let checker;
        for (const [direction, title] of ACTIONS) {
            const key = `move-cursor-${direction}`;
            const row = new Adw.ActionRow({title: t(title)});
            rows.set(key, row);
            const button = new Gtk.Button({valign: Gtk.Align.CENTER});
            const update = () => {
                const value = settings.get_strv(key)[0];
                button.set_child(value ? new Gtk.ShortcutLabel({accelerator: value}) :
                    new Gtk.Label({label: t('Not set')}));
            };
            update();
            signals.push(settings.connect(`changed::${key}`, update));
            button.connect('clicked', () => this._record(window, settings, checker, t, key, t(title)));
            row.add_suffix(button);
            row.set_activatable_widget(button);
            group.add(row);
        }
        const reset = new Gtk.Button({label: t('Restore default shortcuts'), halign: Gtk.Align.START,
            margin_top: 16});
        reset.connect('clicked', () => {
            for (const [direction] of ACTIONS)
                settings.reset(`move-cursor-${direction}`);
        });
        group.add(reset);
        const conflictGroup = new Adw.PreferencesGroup({title: t('Shortcut conflicts')});
        const conflictRow = new Adw.ActionRow({title: t('No conflicts found in the checked GNOME shortcuts.')});
        conflictRow.set_title_lines(0);
        conflictGroup.add(conflictRow);
        page.add(conflictGroup);
        const updateConflicts = () => {
            let any = false;
            for (const [direction] of ACTIONS) {
                const key = `move-cursor-${direction}`;
                const values = settings.get_strv(key);
                const labels = values.flatMap(value => checker.find(value).map(c => c.label));
                for (const [otherDirection, otherTitle] of ACTIONS) {
                    if (otherDirection === direction)
                        continue;
                    const other = settings.get_strv(`move-cursor-${otherDirection}`);
                    if (values.some(v => other.some(o => normalizeAccelerator(v) &&
                        normalizeAccelerator(v) === normalizeAccelerator(o))))
                        labels.push(t(otherTitle));
                }
                const row = rows.get(key);
                row.set_subtitle(labels.length ? t('Conflicts with: {0}', [...new Set(labels)].join('; ')) : '');
                if (labels.length)
                    row.add_css_class('error');
                else
                    row.remove_css_class('error');
                any ||= labels.length > 0;
            }
            conflictRow.set_title(t(any
                ? 'Conflicting shortcuts are marked below each direction. Choose another combination.'
                : 'No conflicts found in the checked GNOME shortcuts.'));
            if (any)
                conflictRow.add_css_class('error');
            else
                conflictRow.remove_css_class('error');
        };
        checker = new ShortcutConflicts(updateConflicts);
        signals.push(settings.connect('changed', updateConflicts));
        updateConflicts();
        const info = new Adw.PreferencesGroup({description:
            t('Default: Super + Ctrl + arrow keys. Changes take effect immediately. Shortcuts are inactive on the lock screen.')});
        const scope = new Adw.ActionRow({title:
            t('Checks GNOME window management, Shell, Mutter, media keys and custom keyboard shortcuts. Some shortcuts registered by other extensions or applications cannot be detected. System shortcuts are never modified.')});
        scope.set_title_lines(0);
        info.add(scope);
        page.add(info);
        window.connect('close-request', () => {
            signals.forEach(id => settings.disconnect(id));
            checker.destroy();
            return false;
        });
    }

    _record(parent, settings, checker, t, key, title) {
        const dialog = new Gtk.Window({title, transient_for: parent, modal: true,
            default_width: 440, default_height: 200, resizable: false});
        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 20,
            margin_top: 28, margin_bottom: 28, margin_start: 24, margin_end: 24});
        const label = new Gtk.Label({label: t('Press a new shortcut\nEsc to cancel · Backspace to clear'),
            wrap: true, justify: Gtk.Justification.CENTER});
        box.append(label);
        const cancel = new Gtk.Button({label: t('Cancel'), halign: Gtk.Align.CENTER});
        cancel.connect('clicked', () => dialog.close());
        box.append(cancel);
        dialog.set_child(box);
        const controller = new Gtk.EventControllerKey();
        controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            let mods = state & Gtk.accelerator_get_default_mod_mask();
            mods &= ~Gdk.ModifierType.LOCK_MASK;
            if (keyval === Gdk.KEY_Escape && !mods) {
                dialog.close();
                return true;
            }
            if (keyval === Gdk.KEY_BackSpace && !mods) {
                settings.set_strv(key, []);
                dialog.close();
                return true;
            }
            const lower = Gdk.keyval_to_lower(keyval);
            if (lower !== keyval)
                mods |= Gdk.ModifierType.SHIFT_MASK;
            const required = Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.ALT_MASK |
                Gdk.ModifierType.SUPER_MASK;
            if (!(mods & required) || !Gtk.accelerator_valid(lower, mods)) {
                if (Gtk.accelerator_valid(lower, mods))
                    label.set_label(t('Include Ctrl, Alt, or Super in the shortcut.'));
                return true;
            }
            const accelerator = Gtk.accelerator_name(lower, mods);
            for (const [direction, otherTitle] of ACTIONS) {
                const otherKey = `move-cursor-${direction}`;
                const duplicate = settings.get_strv(otherKey).some(value => {
                    const [valid, otherKeyval, otherMods] = Gtk.accelerator_parse(value);
                    return valid && otherKeyval === lower && otherMods === mods;
                });
                if (otherKey !== key && duplicate) {
                    label.set_label(t('Already used for “{0}”. Choose another combination or press Esc to cancel.', t(otherTitle)));
                    return true;
                }
            }
            const conflicts = checker.find(accelerator);
            if (conflicts.length) {
                label.set_label(t('This shortcut conflicts with {0}. Choose another combination or press Esc to cancel.',
                    [...new Set(conflicts.map(c => c.label))].join('; ')));
                label.add_css_class('error');
                return true;
            }
            settings.set_strv(key, [accelerator]);
            dialog.close();
            return true;
        });
        dialog.add_controller(controller);
        // Let the recorder receive combinations already handled by the compositor.
        dialog.connect('realize', () => dialog.get_surface().inhibit_system_shortcuts(null));
        dialog.connect('close-request', () => {
            dialog.get_surface()?.restore_system_shortcuts();
            return false;
        });
        dialog.present();
    }
}
