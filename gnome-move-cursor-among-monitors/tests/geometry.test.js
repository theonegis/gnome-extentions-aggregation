import {monitorAtPoint, monitorCenter} from '../geometry.js';

function equal(actual, expected, label) {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const monitors = [
    {x: -1280, y: 120, width: 1280, height: 720},
    {x: 0, y: 0, width: 1536, height: 864},
    {x: 0, y: -1080, width: 1920, height: 1080},
];
equal(monitorAtPoint(monitors, -1, 200), 0, 'negative desktop coordinates');
equal(monitorAtPoint(monitors, 0, 200), 1, 'shared edge belongs to right monitor');
equal(monitorAtPoint(monitors, 1536, 200), -1, 'outside monitor edge');
equal(monitorAtPoint(monitors, -100, 10), -1, 'layout gap');
equal(monitorAtPoint(monitors, 500, -20), 2, 'vertical layout');
equal(monitorAtPoint([], 0, 0), -1, 'no monitors');
equal(monitorCenter(monitors[0]), [-640, 480], 'negative center');
equal(monitorCenter(monitors[1]), [768, 432], 'logical coordinates for scaled display');
equal(monitorCenter({x: 12, y: 9, width: 101, height: 99}), [62, 58], 'integer center');
print('PASS: monitor bounds, gaps, negative coordinates, scaled logical geometry and centers');
