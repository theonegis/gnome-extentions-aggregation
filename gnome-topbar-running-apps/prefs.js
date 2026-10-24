import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TopbarRunningAppsPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: 'Topbar Running Apps Indicator',
            icon_name: 'view-app-grid-symbolic',
        });
        const group = new Adw.PreferencesGroup({
            title: '图标',
        });
        page.add(group);

        this._addSpinRow(group, settings, {
            key: 'icon-size',
            title: '图标大小',
            subtitle: '像素，默认 18',
            lower: 8,
            upper: 128,
        });
        this._addSpinRow(group, settings, {
            key: 'icon-spacing',
            title: '图标间距',
            subtitle: '像素，默认 14',
            lower: 0,
            upper: 64,
        });

        window.add(page);
    }

    _addSpinRow(group, settings, {key, title, subtitle, lower, upper}) {
        const row = Adw.SpinRow.new_with_range(lower, upper, 1);
        row.title = title;
        row.subtitle = subtitle;
        row.value = settings.get_int(key);
        row.connect('notify::value', () => {
            const next = Math.round(row.value);
            if (settings.get_int(key) !== next)
                settings.set_int(key, next);
        });
        settings.connect(`changed::${key}`, () => {
            if (Math.round(row.value) !== settings.get_int(key))
                row.value = settings.get_int(key);
        });
        group.add(row);
    }
}
