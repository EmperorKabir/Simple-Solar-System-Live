#!/usr/bin/env node
// Measure orbital-ring centroid + bounding box of widget bitmaps.
// Detects asymmetric framing (centroid offset) and aspect distortion (ring
// bbox aspect ratio vs bitmap aspect ratio).
//
// Usage: node tools/diag/measure-centroid.mjs <png-or-dir> [more...]
//        node tools/diag/measure-centroid.mjs --json <png-or-dir>

import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Ring pixels: faint rim of a stroked orbit. Excludes Sun (full bright) and
// dark sky (full dark). Include planet bodies too — they sit on rings so the
// centroid contribution is small and consistent across all bitmaps.
const RING_LUMA_MIN = 60;
const RING_LUMA_MAX = 230;

async function measure(file) {
    const img = sharp(file).removeAlpha();
    const { data: raw, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, channels = info.channels;
    let sumX = 0, sumY = 0, count = 0;
    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * channels;
            const r = raw[i], g = raw[i+1], b = raw[i+2];
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            if (luma >= RING_LUMA_MIN && luma <= RING_LUMA_MAX) {
                sumX += x; sumY += y; count++;
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
    }
    const cx = count ? sumX / count : w/2;
    const cy = count ? sumY / count : h/2;
    const bboxW = maxX - minX + 1;
    const bboxH = maxY - minY + 1;
    return {
        file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
        bitmap_w: w,
        bitmap_h: h,
        bitmap_aspect: +(w / h).toFixed(3),
        ring_pixels: count,
        centroid_x: Math.round(cx),
        centroid_y: Math.round(cy),
        offset_x_pct: +(((cx - w/2) / w) * 100).toFixed(2),
        offset_y_pct: +(((cy - h/2) / h) * 100).toFixed(2),
        bbox_x: minX, bbox_y: minY, bbox_w: bboxW, bbox_h: bboxH,
        bbox_aspect: +(bboxW / bboxH).toFixed(3),
        // ratio: how square the bbox is relative to the bitmap
        bbox_vs_bitmap_aspect: +((bboxW/bboxH) / (w/h)).toFixed(3),
        radial_extent_left_pct:   +(((w/2 - minX) / (w/2)) * 100).toFixed(1),
        radial_extent_right_pct:  +(((maxX - w/2) / (w/2)) * 100).toFixed(1),
        radial_extent_top_pct:    +(((h/2 - minY) / (h/2)) * 100).toFixed(1),
        radial_extent_bottom_pct: +(((maxY - h/2) / (h/2)) * 100).toFixed(1)
    };
}

function* walk(p) {
    const st = statSync(p);
    if (st.isDirectory()) {
        for (const e of readdirSync(p)) yield* walk(path.join(p, e));
    } else if (p.toLowerCase().endsWith('.png')) {
        yield p;
    }
}

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const targets = args.filter(a => a !== '--json');
if (targets.length === 0) {
    console.error('usage: measure-centroid.mjs [--json] <png-or-dir> [more...]');
    process.exit(1);
}

const files = [];
for (const t of targets) for (const f of walk(t)) files.push(f);
files.sort();

const results = [];
for (const f of files) {
    try { results.push(await measure(f)); }
    catch (e) { console.error(`ERROR ${f}: ${e.message}`); }
}

if (jsonOnly) {
    process.stdout.write(JSON.stringify({ measured_at: new Date().toISOString(), results }, null, 2));
} else {
    // Compact table
    console.log('file\tbitmap\tring_px\toff_x%\toff_y%\tbbox_aspect\tbbox/bitmap_aspect\tL%\tR%\tT%\tB%');
    for (const r of results) {
        console.log([
            r.file,
            `${r.bitmap_w}x${r.bitmap_h}`,
            r.ring_pixels,
            r.offset_x_pct,
            r.offset_y_pct,
            r.bbox_aspect,
            r.bbox_vs_bitmap_aspect,
            r.radial_extent_left_pct,
            r.radial_extent_right_pct,
            r.radial_extent_top_pct,
            r.radial_extent_bottom_pct
        ].join('\t'));
    }
}
