import { computeHiddenByOverlap } from '../app/src/main/assets/js/LabelOverlap.js';

let fail = 0;
function expect(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); fail++; } else console.log('PASS: ' + msg); }

// Sun + Mercury overlap; Mars stands alone.
{
    const labels = [
        { id: 'Sun',     rect: { x: 100, y: 100, w: 30, h: 14 }, renderedRadius: 80 },
        { id: 'Mercury', rect: { x: 110, y: 105, w: 50, h: 14 }, renderedRadius:  6 },
        { id: 'Mars',    rect: { x: 200, y: 200, w: 30, h: 14 }, renderedRadius: 12 }
    ];
    const hidden = computeHiddenByOverlap(labels);
    expect(hidden.has('Mercury'),  'Mercury hidden behind Sun (smaller of overlap pair)');
    expect(!hidden.has('Sun'),     'Sun visible (larger of overlap pair)');
    expect(!hidden.has('Mars'),    'Mars visible (no overlap)');
}

// Three-way mutual overlap: largest stays, middle stays, smallest hides.
{
    const labels = [
        { id: 'Big',    rect: { x: 0,  y: 0, w: 50, h: 14 }, renderedRadius: 100 },
        { id: 'Medium', rect: { x: 10, y: 0, w: 50, h: 14 }, renderedRadius:  50 },
        { id: 'Tiny',   rect: { x: 20, y: 0, w: 50, h: 14 }, renderedRadius:   5 }
    ];
    const hidden = computeHiddenByOverlap(labels);
    expect(!hidden.has('Big'),     'Big stays (largest)');
    expect(!hidden.has('Medium'),  'Medium stays (middle, only smallest hides per spec)');
    expect(hidden.has('Tiny'),     'Tiny hides');
}

// Equal-size overlap: tie → both stay.
{
    const labels = [
        { id: 'A', rect: { x: 0, y: 0, w: 30, h: 14 }, renderedRadius: 10 },
        { id: 'B', rect: { x: 5, y: 0, w: 30, h: 14 }, renderedRadius: 10 }
    ];
    const hidden = computeHiddenByOverlap(labels);
    expect(!hidden.has('A') && !hidden.has('B'), 'Tie size → both stay visible');
}

if (fail) process.exit(1);
console.log('PASS all label-overlap cases');
