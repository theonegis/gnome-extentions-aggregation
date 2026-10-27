import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export default class TopbarRunningAppsIndicator extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._buttons = new Map();
        this._redisplayId = 0;

        this._button = new PanelMenu.Button(0, 'Topbar Running Apps Indicator', true);
        this._button.remove_style_class_name('panel-button');
        this._button.reactive = false;
        this._button.can_focus = false;
        this._button.track_hover = false;

        this._box = new St.BoxLayout({
            name: 'topbar-running-apps',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._button.add_child(this._box);

        this._settings.connectObject(
            'changed::icon-size', () => this._updateIconSizes(),
            'changed::icon-spacing', () => this._updateSpacing(),
            'changed::grayscale-icons', () => this._updateDesaturation(),
            this);
        this._updateSpacing();

        Shell.AppSystem.get_default().connectObject(
            'app-state-changed', () => this._queueRedisplay(), this);
        Shell.WindowTracker.get_default().connectObject(
            'notify::focus-app', () => this._updateFocus(), this);
        global.display.connectObject(
            'window-created', (_display, window) => {
                this._trackWindow(window);
                this._queueRedisplay();
            }, this);

        for (const actor of global.get_window_actors())
            this._trackWindow(actor.metaWindow);

        Main.panel.addToStatusArea(this.uuid, this._button, 1, 'left');
        this._redisplay();
    }

    disable() {
        if (this._redisplayId) {
            GLib.source_remove(this._redisplayId);
            this._redisplayId = 0;
        }

        this._settings?.disconnectObject(this);
        this._settings = null;

        Shell.AppSystem.get_default().disconnectObject(this);
        Shell.WindowTracker.get_default().disconnectObject(this);
        global.display.disconnectObject(this);

        for (const actor of global.get_window_actors())
            actor.metaWindow?.disconnectObject(this);

        this._buttons = null;
        this._box = null;
        this._button?.destroy();
        this._button = null;
    }

    _trackWindow(window) {
        if (!window)
            return;

        window.connectObject(
            'notify::skip-taskbar', () => this._queueRedisplay(),
            'unmanaged', () => this._queueRedisplay(),
            this);
    }

    _queueRedisplay() {
        if (this._redisplayId)
            return;

        this._redisplayId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._redisplayId = 0;
            if (this._buttons)
                this._redisplay();
            return GLib.SOURCE_REMOVE;
        });
    }

    _appId(app) {
        return app.get_id() || `window-${this._taskbarWindows(app)[0]?.get_id()}`;
    }

    _taskbarWindows(app) {
        return app.get_windows()
            .filter(window => !window.skip_taskbar)
            .sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());
    }

    _runningApps() {
        const apps = Shell.AppSystem.get_default().get_running().filter(app => {
            return this._taskbarWindows(app).length > 0;
        });

        apps.sort((a, b) => {
            const aKey = this._taskbarWindows(a)[0].get_stable_sequence();
            const bKey = this._taskbarWindows(b)[0].get_stable_sequence();
            return aKey - bKey;
        });
        return apps;
    }

    _iconSize() {
        return this._settings.get_int('icon-size');
    }

    _updateSpacing() {
        if (!this._box)
            return;

        const spacing = this._settings.get_int('icon-spacing');
        this._box.style = `spacing: ${spacing}px;`;
    }

    _redisplay() {
        const apps = this._runningApps();
        const seen = new Set();
        const size = this._iconSize();

        for (const app of apps) {
            const id = this._appId(app);
            seen.add(id);

            let button = this._buttons.get(id);
            if (!button) {
                button = this._createButton(app);
                this._buttons.set(id, button);
                this._box.add_child(button);
            }

            if (size > 0)
                this._setIcon(button, size);
        }

        for (const [id, button] of this._buttons) {
            if (seen.has(id))
                continue;
            button.destroy();
            this._buttons.delete(id);
        }

        apps.forEach((app, index) => {
            this._box.set_child_at_index(this._buttons.get(this._appId(app)), index);
        });

        this._updateFocus();
    }

    _createButton(app) {
        const button = new St.Button({
            style_class: 'panel-button topbar-running-app-button',
            can_focus: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            x_align: Clutter.ActorAlign.CENTER,
            track_hover: true,
            accessible_name: app.get_name(),
        });
        button._app = app;
        button._iconSize = 0;
        button._icon = new St.Bin({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        button.set_child(button._icon);
        button._desaturateEffect = null;
        button.connect('clicked', () => this._activate(app));

        app.connectObject('windows-changed', () => this._queueRedisplay(), button);
        return button;
    }

    _setIcon(button, size) {
        if (!(button._iconSize === size && button._icon.child)) {
            button._iconSize = size;
            button._icon.child = button._app.create_icon_texture(size);
            button._desaturateEffect = null;
        }

        this._applyDesaturation(button);
    }

    _updateDesaturation() {
        if (!this._buttons)
            return;

        for (const button of this._buttons.values())
            this._applyDesaturation(button);
    }

    _applyDesaturation(button) {
        const icon = button._icon?.child;
        if (!icon)
            return;

        const grayscale = this._settings.get_boolean('grayscale-icons');
        if (grayscale === Boolean(button._desaturateEffect))
            return;

        if (!grayscale) {
            icon.remove_effect(button._desaturateEffect);
            button._desaturateEffect = null;
            return;
        }

        button._desaturateEffect = new Clutter.DesaturateEffect({factor: 1});
        icon.add_effect(button._desaturateEffect);
    }

    _updateIconSizes() {
        const size = this._iconSize();
        if (!(size > 0) || !this._buttons)
            return;

        for (const button of this._buttons.values())
            this._setIcon(button, size);
    }

    _updateFocus() {
        if (!this._buttons)
            return;

        const focusApp = Shell.WindowTracker.get_default().focus_app;
        for (const button of this._buttons.values()) {
            if (button._app === focusApp)
                button.add_style_pseudo_class('checked');
            else
                button.remove_style_pseudo_class('checked');
        }
    }

    _activate(app) {
        const windows = this._taskbarWindows(app);
        if (windows.length === 0) {
            app.activate();
            return;
        }

        const focused = windows.find(window => window.has_focus());
        let target;
        if (!focused) {
            target = windows[0];
            for (const window of windows) {
                if (window.get_user_time() >= target.get_user_time())
                    target = window;
            }
        } else {
            const index = windows.indexOf(focused);
            target = windows[(index + 1) % windows.length];
        }

        Main.activateWindow(target);
    }
}
