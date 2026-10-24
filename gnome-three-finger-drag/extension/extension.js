import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const SYSTEMD_BUS_NAME = 'org.freedesktop.systemd1';
const SYSTEMD_OBJECT_PATH = '/org/freedesktop/systemd1';
const SYSTEMD_MANAGER_INTERFACE = 'org.freedesktop.systemd1.Manager';
const HELPER_UNIT = 'gnome-three-finger-drag.service';

export default class ThreeFingerDragExtension extends Extension {
    enable() {
        // Do not steal GNOME's gesture unless systemd accepted the helper start.
        this._controlHelper('StartUnit');

        // Captured events are stopped before they reach GNOME Shell's overview and
        // workspace swipe trackers. Non-three-finger gestures pass through.
        this._capturedEventId = global.stage.connect('captured-event', (_actor, event) => {
            if (event.type() !== Clutter.EventType.TOUCHPAD_SWIPE)
                return Clutter.EVENT_PROPAGATE;

            try {
                if (event.get_touchpad_gesture_finger_count() === 3)
                    return Clutter.EVENT_STOP;
            } catch (error) {
                console.warn(`[Three Finger Drag] Cannot inspect gesture: ${error}`);
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    disable() {
        try {
            // SIGTERM makes the helper release BTN_LEFT before it exits.
            this._controlHelper('StopUnit');
        } catch (error) {
            console.error(`[Three Finger Drag] Cannot stop helper: ${error}`);
        } finally {
            if (this._capturedEventId) {
                global.stage.disconnect(this._capturedEventId);
                this._capturedEventId = 0;
            }
        }
    }

    _controlHelper(method) {
        Gio.DBus.session.call_sync(
            SYSTEMD_BUS_NAME,
            SYSTEMD_OBJECT_PATH,
            SYSTEMD_MANAGER_INTERFACE,
            method,
            new GLib.Variant('(ss)', [HELPER_UNIT, 'replace']),
            null,
            Gio.DBusCallFlags.NONE,
            3000,
            null
        );
    }
}
