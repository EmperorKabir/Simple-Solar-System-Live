// SLSS_DIAG_TEMPORARY — calibrate the moon-camera cost against the user's real
// repositioned targets (tools/diag/moon-targets.json). Richer cost model +
// coordinate-descent optimisation + per-moon error breakdown.
import fs from 'node:fs';

const PAIRS = JSON.parse(fs.readFileSync('tools/diag/moon-targets.json', 'utf8'));

const v = (x, y, z) => ({ x, y, z });
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a, s) => v(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1; return v(a.x / l, a.y / l, a.z / l); };
const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const normXZ = (a) => { const l = Math.hypot(a.x, a.z) || 1; return v(a.x / l, 0, a.z / l); };
const MIN_DIST = 1, MAX_DIST = 750, FRAC = 0.15, WALL = 1.2;

function basisFor(phi, tilt) {
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const vd = v(ct * Math.cos(phi), st, ct * Math.sin(phi));
  let r = cross(vd, v(0, 1, 0)); if (len(r) < 1e-6) r = v(1, 0, 0); r = norm(r);
  return { viewDir: vd, right: r, trueUp: norm(cross(r, vd)) };
}
function projNDC(w, cam, b, hH, hV) { const rel = sub(w, cam), d = dot(rel, b.viewDir); if (d <= 1e-6) return { x: NaN, y: NaN, depth: d }; return { x: dot(rel, b.right) / (Math.tan(hH) * d), y: dot(rel, b.trueUp) / (Math.tan(hV) * d), depth: d }; }
const radNDC = (s, d, hH, hV) => d <= 1e-6 ? { x: 0, y: 0 } : { x: (s / d) / Math.tan(hH), y: (s / d) / Math.tan(hV) };
function axisFrac(c, r) { if (!isFinite(c)) return 0; if (r <= 1e-9) return (c >= -1 && c <= 1) ? 1 : 0; const lo = Math.max(c - r, -1), hi = Math.min(c + r, 1); return Math.max(0, (hi - lo) / (2 * r)); }
const disc = (n, r) => (!isFinite(n.x) || !isFinite(n.y)) ? 0 : Math.min(axisFrac(n.x, r.x), axisFrac(n.y, r.y));

// BOTH-required, max-zoom, X-symmetric + vertically centred, PLUS a Sun-lean
// for big/close planets: the frame rotates toward the Sun (Sun pulled to a small
// target offset, planet stays at the edge). Big-ness = planet apparent radius at
// max zoom beyond a threshold.
function place(s, W) {
  const hV = (70 * Math.PI) / 360, hH = Math.atan(Math.tan(hV) * s.aspect);
  const mw = s.moonWorld, pw = s.planetWorld, sw = v(0, 0, 0);
  const ev = (b, d) => { const cam = sub(mw, scale(b.viewDir, d)); const pj = projNDC(pw, cam, b, hH, hV), sj = projNDC(sw, cam, b, hH, hV); const pr = radNDC(s.planetSize, pj.depth, hH, hV), sr = radNDC(2.5, sj.depth, hH, hV); return { pj, sj, pr, sr, pF: disc(pj, pr), sF: disc(sj, sr) }; };
  const NPHI = 49, NT = 17, TR = (60 * Math.PI) / 180;
  let planetRadMin = Infinity;
  for (let i = 0; i < NPHI; i++) { const phi = -Math.PI + (2 * Math.PI * i) / (NPHI - 1); const b = basisFor(phi, 0); const e = ev(b, MIN_DIST); if (e.pj.depth > 0) planetRadMin = Math.min(planetRadMin, Math.max(e.pr.x, e.pr.y)); }
  const big = planetRadMin > W.bigThresh; // close/dominant planet (Io's Jupiter)

  // BOTH-required, max-zoom candidate set (planet kept at the edge, not a wall).
  const ok = (e) => e.pF >= FRAC && e.sF >= FRAC && e.pr.x <= WALL && e.pr.y <= WALL && e.sr.x <= WALL && e.sr.y <= WALL;
  const sd = (b) => { if (ok(ev(b, MIN_DIST))) return MIN_DIST; if (!ok(ev(b, MAX_DIST))) return Infinity; let lo = MIN_DIST, hi = MAX_DIST; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ok(ev(b, m))) hi = m; else lo = m; } return hi; };
  const cands = []; let dMin = Infinity;
  for (let i = 0; i < NPHI; i++) { const phi = -Math.PI + (2 * Math.PI * i) / (NPHI - 1); for (let j = 0; j < NT; j++) { const tilt = -TR + (2 * TR * j) / (NT - 1); const b = basisFor(phi, tilt); const d = sd(b); if (isFinite(d)) { cands.push({ b, d }); if (d < dMin) dMin = d; } } }
  if (!cands.length) return null;
  let best = null;
  for (const c of cands) {
    if (c.d > dMin * 1.10 + 1e-9) continue;
    const e = ev(c.b, c.d);
    // Normal planets: symmetric. Big planets: rotate toward the Sun (Sun pulled
    // to a small target offset opposite the planet) instead of forced symmetry.
    let framing;
    if (big) { const sunTgt = -Math.sign(e.pj.x || 1) * W.sunTarget; framing = Math.abs(e.sj.x - sunTgt); }
    else framing = Math.abs(e.pj.x + e.sj.x) + W.wSp * Math.max(Math.abs(e.pj.x), Math.abs(e.sj.x));
    const cost = framing + W.wY * (Math.abs(e.pj.y) + Math.abs(e.sj.y)) + W.wZ * (c.d / dMin - 1);
    if (best === null || cost < best.cost) best = { cost, e };
  }
  return best ? best.e : null;
}

function errOf(W) {
  let tot = 0, n = 0; const byMoon = {};
  for (const s of PAIRS) {
    const r = place(s, W); if (!r) continue; const t = s.target;
    const e = Math.abs(r.pj.x - t.hx) + Math.abs(r.pj.y - t.hy) + Math.abs(r.sj.x - t.sx) + Math.abs(r.sj.y - t.sy);
    tot += e; n++; (byMoon[s.moon] = byMoon[s.moon] || []).push(e);
  }
  return { mean: tot / n, n, byMoon };
}

// Coordinate descent over weights.
let W = { wY: 1.5, wSp: 0.15, wZ: 0.5, bigThresh: 0.5, wLean: 2, sunTarget: 0.3 };
const steps = { wY: [0.5, 1, 1.5, 2, 3], wSp: [0, 0.1, 0.2], wZ: [0.2, 0.5, 1], bigThresh: [0.3, 0.4, 0.5, 0.7], sunTarget: [0.0, 0.2, 0.3, 0.45] };
let cur = errOf(W).mean;
for (let pass = 0; pass < 3; pass++) {
  for (const k of Object.keys(steps)) {
    let bestV = W[k], bestE = cur;
    for (const val of steps[k]) { const W2 = { ...W, [k]: val }; const e = errOf(W2).mean; if (e < bestE) { bestE = e; bestV = val; } }
    W[k] = bestV; cur = bestE;
  }
}
const res = errOf(W);
console.log('optimised weights:', JSON.stringify(W));
console.log('mean error:', res.mean.toFixed(3), 'n=', res.n);
console.log('\nper-moon mean error (worst first):');
const rows = Object.entries(res.byMoon).map(([m, a]) => [m, a.reduce((x, y) => x + y, 0) / a.length, a.length]).sort((x, y) => y[1] - x[1]);
for (const [m, e, n] of rows) console.log('  ' + m.padEnd(10) + ' err=' + e.toFixed(3) + ' (n=' + n + ')');
