#!/usr/bin/env node
// Per-row and per-column luminance sums. Identifies where in the image the
// bright pixels sit. Output: TSV of row and column profiles.
// Usage: node tools/diag/luma-profile.mjs <png>

import sharp from 'sharp';
import path from 'node:path';

const file = process.argv[2];
if (!file) { console.error('usage: luma-profile.mjs <png>'); process.exit(1); }

const img = sharp(file).removeAlpha();
const { data: raw, info } = await img.raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height, channels = info.channels;

const rowSum = new Float64Array(h);
const colSum = new Float64Array(w);
let totalSum = 0;
for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
        const i = (y * w + x) * channels;
        const r = raw[i], g = raw[i+1], b = raw[i+2];
        const luma = 0.299*r + 0.587*g + 0.114*b;
        rowSum[y] += luma;
        colSum[x] += luma;
        totalSum += luma;
    }
}

// Centroid of luma
let cyW = 0, cxW = 0;
for (let y = 0; y < h; y++) cyW += y * rowSum[y];
for (let x = 0; x < w; x++) cxW += x * colSum[x];
const cy = cyW / totalSum;
const cx = cxW / totalSum;

console.log(JSON.stringify({
    file: path.basename(file),
    w, h,
    weighted_centroid_x: +cx.toFixed(1),
    weighted_centroid_y: +cy.toFixed(1),
    weighted_offset_x_pct: +(((cx - w/2) / w) * 100).toFixed(2),
    weighted_offset_y_pct: +(((cy - h/2) / h) * 100).toFixed(2),
    total_luma: Math.round(totalSum)
}, null, 2));

// Row profile: bin into 20 horizontal bands, print percentage of total luma per band
const bands = 20;
const bandH = h / bands;
const bandLuma = new Float64Array(bands);
for (let y = 0; y < h; y++) bandLuma[Math.min(bands-1, Math.floor(y / bandH))] += rowSum[y];
console.log('\nROW BAND   |' + '          '.repeat(2) + '%-of-total-luma   (visual proportional bar)');
for (let b = 0; b < bands; b++) {
    const pct = (bandLuma[b] / totalSum * 100);
    const bar = '#'.repeat(Math.round(pct * 2));
    console.log(`row ${(b/bands*100).toFixed(0).padStart(3)}-${((b+1)/bands*100).toFixed(0).padStart(3)}%  | ${pct.toFixed(2).padStart(6)}%  ${bar}`);
}

// Column profile
const colBands = new Float64Array(bands);
const bandW = w / bands;
for (let x = 0; x < w; x++) colBands[Math.min(bands-1, Math.floor(x / bandW))] += colSum[x];
console.log('\nCOL BAND   |          %-of-total-luma   (visual proportional bar)');
for (let b = 0; b < bands; b++) {
    const pct = (colBands[b] / totalSum * 100);
    const bar = '#'.repeat(Math.round(pct * 2));
    console.log(`col ${(b/bands*100).toFixed(0).padStart(3)}-${((b+1)/bands*100).toFixed(0).padStart(3)}%  | ${pct.toFixed(2).padStart(6)}%  ${bar}`);
}
