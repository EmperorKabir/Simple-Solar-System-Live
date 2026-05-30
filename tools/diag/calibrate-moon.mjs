// SLSS_DIAG_TEMPORARY — calibrate the moon-camera 2D orientation cost against
// the user's real repositioned targets (tools/diag/moon-targets.json).
// Grid-searches cost weights to minimise mean framing error vs ground truth.
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
  const viewDir = v(ct * Math.cos(phi), st, ct * Math.sin(phi));
  let right = cross(viewDir, v(0, 1, 0));
  if (len(right) < 1e-6) right = v(1, 0, 0);
  right = norm(right);
  return { viewDir, right, trueUp: norm(cross(right, viewDir)) };
}
function projNDC(w, cam, b, hH, hV) {
  const rel = sub(w, cam), depth = dot(rel, b.viewDir);
  if (depth <= 1e-6) return { x: NaN, y: NaN, depth };
  return { x: dot(rel, b.right) / (Math.tan(hH) * depth), y: dot(rel, b.trueUp) / (Math.tan(hV) * depth), depth };
}
const radNDC = (sz, d, hH, hV) => d <= 1e-6 ? { x: 0, y: 0 } : { x: (sz / d) / Math.tan(hH), y: (sz / d) / Math.tan(hV) };
function axisFrac(c, r) { if (!isFinite(c)) return 0; if (r <= 1e-9) return (c >= -1 && c <= 1) ? 1 : 0; const lo = Math.max(c - r, -1), hi = Math.min(c + r, 1); return Math.max(0, (hi - lo) / (2 * r)); }
const disc = (n, r) => (!isFinite(n.x) || !isFinite(n.y)) ? 0 : Math.min(axisFrac(n.x, r.x), axisFrac(n.y, r.y));

// Candidate placement for the BOTH framing, parameterised by cost weights.
function place(s, W) {
  const hV = (70 * Math.PI) / 360, hH = Math.atan(Math.tan(hV) * s.aspect);
  const mw = s.moonWorld, pw = s.planetWorld, sw = v(0, 0, 0);
  const pXZ = normXZ(sub(pw, mw)), sXZ = normXZ(sub(sw, mw));
  const ev = (b, d) => {
    const cam = sub(mw, scale(b.viewDir, d));
    const pj = projNDC(pw, cam, b, hH, hV), sj = projNDC(sw, cam, b, hH, hV);
    const pr = radNDC(s.planetSize, pj.depth, hH, hV), sr = radNDC(2.5, sj.depth, hH, hV);
    return { pj, sj, pr, sr, pF: disc(pj, pr), sF: disc(sj, sr) };
  };
  const ok = (e) => e.pF >= FRAC && e.sF >= FRAC && e.pr.x <= WALL && e.pr.y <= WALL && e.sr.x <= WALL && e.sr.y <= WALL;
  const smallestD = (b) => { if (ok(ev(b, MIN_DIST))) return MIN_DIST; if (!ok(ev(b, MAX_DIST))) return Infinity; let lo = MIN_DIST, hi = MAX_DIST; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ok(ev(b, m))) hi = m; else lo = m; } return hi; };
  const NPHI = 49, NT = W.nt;
  const cands = []; let dMin = Infinity;
  for (let i = 0; i < NPHI; i++) {
    const phi = -Math.PI + (2 * Math.PI * i) / (NPHI - 1);
    for (let j = 0; j < NT; j++) {
      const tilt = NT === 1 ? 0 : -W.tiltMax + (2 * W.tiltMax * j) / (NT - 1);
      const b = basisFor(phi, tilt), d = smallestD(b);
      if (isFinite(d)) { cands.push({ b, d }); if (d < dMin) dMin = d; }
    }
  }
  if (!cands.length) return null;
  let best = null;
  for (const c of cands) {
    if (c.d > dMin * 1.10 + 1e-9) continue;
    const e = ev(c.b, c.d);
    const asymX = Math.abs(e.pj.x + e.sj.x);
    const flatY = Math.abs(e.pj.y) + Math.abs(e.sj.y);
    const spreadX = Math.max(Math.abs(e.pj.x), Math.abs(e.sj.x));
    const cost = asymX + W.wY * flatY + W.wSpread * spreadX + W.wZoom * (c.d / dMin - 1);
    if (best === null || cost < best.cost) best = { cost, e };
  }
  return best.e;
}

// Evaluate weight set: mean L1 framing error over both-visible samples.
function evalW(W) {
  let err = 0, n = 0;
  for (const s of PAIRS) {
    const t = s.target;
    if (Math.max(Math.abs(t.hx), Math.abs(t.sx)) > 1.3) continue; // skip drop-cases
    const r = place(s, W);
    if (!r) continue;
    err += Math.abs(r.pj.x - t.hx) + Math.abs(r.pj.y - t.hy) + Math.abs(r.sj.x - t.sx) + Math.abs(r.sj.y - t.sy);
    n++;
  }
  return { mean: err / n, n };
}

const grid = [];
for (const wY of [0.0, 0.5, 1.0, 1.5, 2.0])
  for (const wSpread of [0.0, 0.15, 0.3])
    for (const tiltMax of [0, (40 * Math.PI) / 180, (60 * Math.PI) / 180])
      for (const wZoom of [0.2, 0.5])
        grid.push({ wY, wSpread, tiltMax, wZoom, nt: tiltMax === 0 ? 1 : 21 });

console.log(`calibrating over ${grid.length} weight sets, ${PAIRS.length} pairs...`);
const results = grid.map((W) => ({ W, ...evalW(W) })).sort((a, b) => a.mean - b.mean);
const deg = (r) => (r * 180 / Math.PI).toFixed(0);
console.log('\nbest weight sets (lower mean error = closer to your targets):');
for (const r of results.slice(0, 8)) {
  console.log(`  mean=${r.mean.toFixed(3)} n=${r.n}  wY=${r.W.wY} wSpread=${r.W.wSpread} tiltMax=${deg(r.W.tiltMax)}deg wZoom=${r.W.wZoom}`);
}
console.log('\nworst (for contrast):');
for (const r of results.slice(-3)) console.log(`  mean=${r.mean.toFixed(3)} wY=${r.W.wY} tiltMax=${deg(r.W.tiltMax)}deg`);
