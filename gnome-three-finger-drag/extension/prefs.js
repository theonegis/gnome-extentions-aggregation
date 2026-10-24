import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ThreeFingerDragPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const directory = GLib.build_filenamev([GLib.get_user_config_dir(), 'gnome-three-finger-drag']);
        const path = GLib.build_filenamev([directory, 'release-delay-ms']);
        let delay = 2000;
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            const [ok, contents] = GLib.file_get_contents(path);
            const value = new TextDecoder().decode(contents).trim();
            if (ok && /^\d+$/.test(value) && Number(value) <= 10000)
                delay = Number(value);
        }
        const page = new Adw.PreferencesPage({title: 'Three Finger Drag', icon_name: 'input-touchpad-symbolic'});
        const group = new Adw.PreferencesGroup({
            title: 'Drag Release',
            description: 'Resume a three-finger swipe within the delay to continue dragging. Tap the touchpad to release early. Disabling the extension releases immediately.',
        });
        const row = new Adw.SpinRow({
            title: 'Release delay (seconds)',
            subtitle: 'Default: 2 seconds. Set to 0 to release immediately. Changes apply when the next gesture ends.',
            digits: 1,
            adjustment: new Gtk.Adjustment({lower: 0, upper: 10, step_increment: 0.1, page_increment: 1, value: delay / 1000}),
        });
        row.connect('notify::value', () => {
            try {
                if (GLib.mkdir_with_parents(directory, 0o700) !== 0)
                    throw new Error('Could not create the configuration directory');
                Gio.File.new_for_path(path).replace_contents(
                    new TextEncoder().encode(`${Math.round(row.value * 1000)}\n`),
                    null, false, Gio.FileCreateFlags.PRIVATE, null);
            } catch (error) {
                window.add_toast(new Adw.Toast({title: `Could not save settings: ${error.message}`}));
            }
        });
        group.add(row);
        page.add(group);
        window.add(page);
    }
}
