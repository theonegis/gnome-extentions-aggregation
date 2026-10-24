import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {monitorAtPoint, monitorCenter} from './geometry.js';

const DIRECTIONS = {
    left: Meta.DisplayDirection.LEFT,
    right: Meta.DisplayDirection.RIGHT,
    up: Meta.DisplayDirection.UP,
    down: Meta.DisplayDirection.DOWN,
};

export default class MoveCursorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._bindings = [];
        try {
            for (const [name, direction] of Object.entries(DIRECTIONS)) {
                const key = `move-cursor-${name}`;
                const action = Main.wm.addKeybinding(key, this._settings,
                    Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                    Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                    () => this._move(direction));
                if (action === Meta.KeyBindingAction.NONE)
                    throw new Error(`Could not register shortcut ${key}`);
                this._bindings.push(key);
            }
        } catch (error) {
            this.disable();
            throw error;
        }
    }

    _move(direction) {
        // Read the layout each time: hotplug, rotation and scaling can change it.
        const monitors = Main.layoutManager.monitors;
        const [x, y] = global.get_pointer();
        const current = monitorAtPoint(monitors, x, y);
        if (current < 0 || monitors.length < 2)
            return;

        const next = global.display.get_monitor_neighbor_index(current, direction);
        if (next < 0 || !monitors[next])
            return;

        const [targetX, targetY] = monitorCenter(monitors[next]);
        global.stage.context.get_backend().get_default_seat().warp_pointer(targetX, targetY);
    }

    disable() {
        for (const key of this._bindings ?? [])
            Main.wm.removeKeybinding(key);
        this._bindings = [];
        this._settings = null;
    }
}
