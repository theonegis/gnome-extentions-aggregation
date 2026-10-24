import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

export function normalizeAccelerator(value) {
    const [valid, keyval, mods] = Gtk.accelerator_parse(value);
    return valid && keyval !== 0 ? `${keyval}:${mods}` : null;
}

const SCHEMAS = [
    'org.gnome.desktop.wm.keybindings',
    'org.gnome.shell.keybindings',
    'org.gnome.mutter.keybindings',
    'org.gnome.mutter.wayland.keybindings',
    'org.gnome.settings-daemon.plugins.media-keys',
];
const CUSTOM_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding';

export class ShortcutConflicts {
    constructor(onChanged) {
        this._onChanged = onChanged;
        this._sources = [];
        this._customSources = [];
        const source = Gio.SettingsSchemaSource.get_default();
        for (const id of SCHEMAS) {
            const schema = source.lookup(id, true);
            if (!schema)
                continue;
            const settings = new Gio.Settings({settings_schema: schema});
            const signal = settings.connect('changed', (_settings, key) => {
                if (id.endsWith('.media-keys') && key === 'custom-keybindings')
                    this._reloadCustom();
                this._onChanged();
            });
            this._sources.push({id, settings, signal});
        }
        this._reloadCustom();
    }

    _reloadCustom() {
        for (const {settings, signal} of this._customSources)
            settings.disconnect(signal);
        this._customSources = [];
        const media = this._sources.find(s => s.id.endsWith('.media-keys'));
        const schema = Gio.SettingsSchemaSource.get_default().lookup(CUSTOM_SCHEMA, true);
        if (!media || !schema || !media.settings.settings_schema.has_key('custom-keybindings'))
            return;
        for (const path of media.settings.get_strv('custom-keybindings')) {
            if (!path.startsWith('/') || !path.endsWith('/'))
                continue;
            const settings = new Gio.Settings({settings_schema: schema, path});
            const signal = settings.connect('changed', () => this._onChanged());
            this._customSources.push({id: CUSTOM_SCHEMA, settings, signal});
        }
    }

    find(accelerator) {
        const wanted = normalizeAccelerator(accelerator);
        if (!wanted)
            return [];
        const matches = [];
        for (const {id, settings} of [...this._sources, ...this._customSources]) {
            const custom = id === CUSTOM_SCHEMA;
            const schema = settings.settings_schema;
            for (const key of custom ? ['binding'] : schema.list_keys()) {
                const value = settings.get_value(key);
                const type = value.get_type_string();
                const values = type === 'as' ? value.deepUnpack() :
                    type === 's' ? [value.deepUnpack()] : [];
                if (values.some(v => normalizeAccelerator(v) === wanted)) {
                    const summary = custom ? settings.get_string('name') : schema.get_key(key).get_summary();
                    matches.push({schema: id, key, label: summary || key});
                }
            }
        }
        return matches;
    }

    destroy() {
        for (const {settings, signal} of [...this._sources, ...this._customSources])
            settings.disconnect(signal);
        this._sources = [];
        this._customSources = [];
        this._onChanged = null;
    }
}
