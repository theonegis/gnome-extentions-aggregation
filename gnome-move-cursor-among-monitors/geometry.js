// GNOME exposes monitor rectangles in logical desktop coordinates.
export function monitorAtPoint(monitors, x, y) {
    return monitors.findIndex(m => x >= m.x && x < m.x + m.width &&
        y >= m.y && y < m.y + m.height);
}

export function monitorCenter(monitor) {
    return [monitor.x + Math.floor(monitor.width / 2),
        monitor.y + Math.floor(monitor.height / 2)];
}
