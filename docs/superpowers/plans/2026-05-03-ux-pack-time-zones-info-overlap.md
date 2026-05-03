# UX Pack: Time-Shift Extras + Time Zones + Info Guide + Label-Overlap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 user-facing features in a single batch: (1) bigger time-jump options + hold-to-repeat; (2) local time-zone display with picker; (3) tappable info-guide modal; (4) automatic fade-out of the smaller of two overlapping body labels.

**Architecture:** All changes are pure UI / display layer — zero impact on the Horizons-verified orbital math. New buttons feed into the existing `setTimeOverride` API. Time-zone work is presentation-only: engine still computes in UT. Label-overlap fade hooks into the existing CSS2D label render loop and adds a parallel `.label-overlapped` class so it stacks cleanly with existing `.hidden-label` (zoom + occlusion) logic. Info modal is plain HTML/CSS/JS with `<details>` collapsibles for native accordion behaviour.

**Tech Stack:** JavaScript ES modules, HTML/CSS, Three.js (existing), `Intl.DateTimeFormat` for time-zone offset, `localStorage` for persistence. No external deps.

---

## Iron rules

1. **No regression in orbital math.** All existing regression tests must still pass (saturn-scaling, moon-frame-fix, all-moons-spotcheck, overlap-check).
2. **Label `.hidden-label` semantics preserved exactly.** Any new logic uses a parallel class.
3. **Single final commit** combining all four features once verified.
4. **Use Context7** for any DOM API question (especially `<details>` accessibility, `Intl.DateTimeFormat.resolvedOptions().timeZone`, pointer-event semantics for hold-to-repeat).
5. On-device adb verification after each phase before moving on.

---

## File structure

| File | Role |
|---|---|
| `app/src/main/assets/js/TimeOverride.js` | Extend `addUT` to handle `years`, `weeks`, optional `decades` (= 10 years). Add timezone helpers (load/save/resolve). |
| `app/src/main/assets/js/LabelOverlap.js` | NEW — per-frame overlap detection module. Pure function: `applyLabelOverlapFade(labels, camera, viewport)`. Toggles `.label-overlapped` class. |
| `app/src/main/assets/js/UserGuide.js` | NEW — guide content as a structured array of section objects (title, body, optional sub-sections). Renders the modal HTML on first open. |
| `app/src/main/assets/index.html` | Wire all four features. Add HTML for new buttons / info icon / TZ picker / guide modal. CSS for hold-to-repeat visual feedback, accordion styling, TZ picker. |
| `tests/time-override-extras.test.mjs` | NEW — verify `addUT` handles weeks/years/decades and the calendar-month edge case (Jan 31 + 1 month). |
| `tests/label-overlap.test.mjs` | NEW — pure-function test of overlap detection given mock label rects. |

---

## Phase A: Time-shift extras (buttons + hold-to-repeat)

### Task A1: Extend `TimeOverride.addUT` to support weeks + years

**Files:**
- Modify: `app/src/main/assets/js/TimeOverride.js` (`addUT` function only)
- Create: `tests/time-override-extras.test.mjs`

- [ ] **Step A1.1: Write failing test**

```javascript
// tests/time-override-extras.test.mjs
import { addUT } from '../app/src/main/assets/js/TimeOverride.js';

const start = new Date(Date.UTC(2026, 4, 3, 0, 0, 0));   // 2026-05-03 UT
let pass = 0, fail = 0;
function check(label, got, want) {
    const ok = got.toISOString() === want.toISOString();
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(40)}  got=${got.toISOString()}  want=${want.toISOString()}`);
    ok ? pass++ : fail++;
}
check('+1 week',    addUT(start, { weeks:  1 }), new Date(Date.UTC(2026, 4, 10, 0, 0, 0)));
check('-1 week',    addUT(start, { weeks: -1 }), new Date(Date.UTC(2026, 3, 26, 0, 0, 0)));
check('+1 year',    addUT(start, { years:  1 }), new Date(Date.UTC(2027, 4,  3, 0, 0, 0)));
check('+10 years (1 decade)', addUT(start, { years: 10 }), new Date(Date.UTC(2036, 4, 3, 0, 0, 0)));
check('Feb 29 + 1 year (leap)', addUT(new Date(Date.UTC(2028, 1, 29)), { years: 1 }), new Date(Date.UTC(2029, 2, 1)));  // Feb 29 → Mar 1 in non-leap
console.log(`${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass+fail}`);
if (fail) process.exit(1);
```

- [ ] **Step A1.2: Run test (expect FAIL — `weeks`/`years` not supported)**

```bash
node tests/time-override-extras.test.mjs
```

Expected: at least the +1 week / +1 year cases fail.

- [ ] **Step A1.3: Extend `addUT`**

```javascript
// In TimeOverride.js, replace the body of addUT:
export function addUT(date, { hours = 0, days = 0, weeks = 0, months = 0, years = 0 } = {}) {
    const d = new Date(date.getTime());
    if (years)  d.setUTCFullYear(d.getUTCFullYear() + years);
    if (months) d.setUTCMonth(d.getUTCMonth() + months);
    if (weeks)  d.setUTCDate(d.getUTCDate() + weeks * 7);
    if (days)   d.setUTCDate(d.getUTCDate() + days);
    if (hours)  d.setUTCHours(d.getUTCHours() + hours);
    return d;
}
```

- [ ] **Step A1.4: Re-run test (expect PASS)**

```bash
node tests/time-override-extras.test.mjs
```

Expected: PASS.

### Task A2: Add 6 new buttons to time-controls UI

**Files:**
- Modify: `app/src/main/assets/index.html` (HTML inside `#time-controls` + `NUDGE` constant)

- [ ] **Step A2.1: Replace existing time-controls block with 12-button grid**

Current 6 buttons; new 12. Order: `−1dec −1y −1mo −1w −1d −1h | +1h +1d +1w +1mo +1y +1dec`. Use `data-tnudge` keys: `-1dec, -1y, -1mo, -1w, -1d, -1h, +1h, +1d, +1w, +1mo, +1y, +1dec`. Wraps to 2 rows naturally on phones via existing `flex-wrap`.

```html
<div id="time-controls">
    <button class="time-btn" data-tnudge="-1dec" title="-1 decade">−1dec</button>
    <button class="time-btn" data-tnudge="-1y"   title="-1 year">−1y</button>
    <button class="time-btn" data-tnudge="-1mo"  title="-1 month">−1mo</button>
    <button class="time-btn" data-tnudge="-1w"   title="-1 week">−1w</button>
    <button class="time-btn" data-tnudge="-1d"   title="-1 day">−1d</button>
    <button class="time-btn" data-tnudge="-1h"   title="-1 hour">−1h</button>
    <button class="time-btn" data-tnudge="+1h"   title="+1 hour">+1h</button>
    <button class="time-btn" data-tnudge="+1d"   title="+1 day">+1d</button>
    <button class="time-btn" data-tnudge="+1w"   title="+1 week">+1w</button>
    <button class="time-btn" data-tnudge="+1mo"  title="+1 month">+1mo</button>
    <button class="time-btn" data-tnudge="+1y"   title="+1 year">+1y</button>
    <button class="time-btn" data-tnudge="+1dec" title="+1 decade">+1dec</button>
</div>
```

- [ ] **Step A2.2: Extend the `NUDGE` table**

```javascript
const NUDGE = {
    '-1dec':{ years: -10 }, '+1dec':{ years: +10 },
    '-1y':  { years: -1  }, '+1y':  { years: +1  },
    '-1mo': { months: -1 }, '+1mo': { months: +1 },
    '-1w':  { weeks:  -1 }, '+1w':  { weeks:  +1 },
    '-1d':  { days:   -1 }, '+1d':  { days:   +1 },
    '-1h':  { hours:  -1 }, '+1h':  { hours:  +1 }
};
```

### Task A3: Hold-to-repeat (750 ms hold → 4 nudges/sec)

**Files:**
- Modify: `app/src/main/assets/index.html` (the `timeBtns.forEach(...)` block)

- [ ] **Step A3.1: Replace existing click-only handler with pointer-down/up + hold timer**

```javascript
const HOLD_DELAY_MS  = 750;
const REPEAT_INTERVAL_MS = 250;     // 4 per second

function attachNudge(btn) {
    let holdTimer = null;
    let repeatTimer = null;
    let didFire = false;
    const fire = () => {
        const delta = NUDGE[btn.dataset.tnudge];
        if (!delta) return;
        const base = getEffectiveDate();
        setTimeOverride(addUT(base, delta));
        refreshTimeDisplay();
        didFire = true;
    };
    const cancel = () => {
        if (holdTimer)   { clearTimeout(holdTimer);   holdTimer = null; }
        if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
    };
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        didFire = false;
        // After 750ms of hold, start the 4 Hz repeat. Single-tap fires once
        // immediately on pointerup if no repeat ran (handled below).
        holdTimer = setTimeout(() => {
            holdTimer = null;
            fire();   // first repeat fire
            repeatTimer = setInterval(fire, REPEAT_INTERVAL_MS);
        }, HOLD_DELAY_MS);
    });
    btn.addEventListener('pointerup', () => {
        if (!didFire) fire();   // brief tap → single nudge
        cancel();
    });
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('pointercancel', cancel);
}
timeBtns.forEach(attachNudge);
```

- [ ] **Step A3.2: Build, install, test on device**

```bash
./gradlew.bat installDebug
# (relaunch app, hold a button, verify >750ms = repeats, brief tap = single)
```

---

## Phase B: Time-zone display + picker

### Task B1: TimeOverride helpers

**Files:**
- Modify: `app/src/main/assets/js/TimeOverride.js`

Add helpers:

```javascript
const TZ_STORAGE_KEY = 'slss.timezone';   // 'system' or signed minutes-offset like '-300'

/** Detected system zone via Intl. Returns { name: 'Europe/London', offsetMin: 60 } or null. */
export function detectSystemTimeZone() {
    try {
        const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!name) return null;
        const now = new Date();
        // offset = local minutes ahead of UT
        const offsetMin = -now.getTimezoneOffset();
        return { name, offsetMin };
    } catch (e) { return null; }
}

/** Stored choice. 'system' or numeric offset minutes. Returns null if user has not chosen. */
export function loadStoredZone() {
    try { return localStorage.getItem(TZ_STORAGE_KEY); } catch (e) { return null; }
}
export function saveStoredZone(value) {
    try { localStorage.setItem(TZ_STORAGE_KEY, String(value)); } catch (e) {}
}

/** Resolve effective offset minutes (positive = ahead of UT). */
export function resolveEffectiveOffsetMin() {
    const stored = loadStoredZone();
    if (stored && stored !== 'system') {
        const n = parseInt(stored, 10);
        if (Number.isFinite(n)) return n;
    }
    const sys = detectSystemTimeZone();
    return sys ? sys.offsetMin : 0;   // fallback UT
}

/** Format a Date as local-time string with TZ tag, e.g. '2026-05-03 14:23:09 BST' or 'UTC+05:30'. */
export function formatLocal(date, offsetMin) {
    const tagged = new Date(date.getTime() + offsetMin * 60_000);
    const Y = tagged.getUTCFullYear();
    const M = String(tagged.getUTCMonth() + 1).padStart(2, '0');
    const D = String(tagged.getUTCDate()).padStart(2, '0');
    const h = String(tagged.getUTCHours()).padStart(2, '0');
    const m = String(tagged.getUTCMinutes()).padStart(2, '0');
    const s = String(tagged.getUTCSeconds()).padStart(2, '0');
    const sign = offsetMin >= 0 ? '+' : '-';
    const aoff = Math.abs(offsetMin);
    const oh = String(Math.floor(aoff / 60)).padStart(2, '0');
    const om = String(aoff % 60).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}:${s} UTC${sign}${oh}:${om}`;
}

/** Convert datetime-local input (interpreted as LOCAL time at `offsetMin`) into UT Date. */
export function parseFromLocalInput(value, offsetMin) {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!m) return null;
    // Treat input as local-zone wall clock, convert to UT.
    const localMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    const utMs = localMs - offsetMin * 60_000;
    return new Date(utMs);
}

/** Format a Date for <input type="datetime-local"> in given LOCAL zone offset. */
export function formatForInputLocal(date, offsetMin) {
    const tagged = new Date(date.getTime() + offsetMin * 60_000);
    const Y = tagged.getUTCFullYear();
    const M = String(tagged.getUTCMonth() + 1).padStart(2, '0');
    const D = String(tagged.getUTCDate()).padStart(2, '0');
    const h = String(tagged.getUTCHours()).padStart(2, '0');
    const m = String(tagged.getUTCMinutes()).padStart(2, '0');
    const s = String(tagged.getUTCSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D}T${h}:${m}:${s}`;
}
```

### Task B2: TZ picker UI + first-launch logic

**Files:**
- Modify: `app/src/main/assets/index.html` (HTML for picker modal + small TZ chip in time-display + JS wiring)

- [ ] **Step B2.1: Build the offset list**

32 entries from UTC−12:00 through UTC+14:00 in 30-minute steps where used. Skip exotic 45-minute zones (UTC+5:45 Nepal, UTC+12:45 Chatham — note "approx 30" zones globally; these two are the only 45-min, omitted to keep the list tidy and matching user spec).

```javascript
const TZ_OFFSET_OPTIONS = [
    -720, -660, -600, -540, -510, -480, -420, -360, -300, -270, -240, -210,
    -180, -150, -120,  -60,    0,   60,  120,  180,  210,  240,  270,  300,
     330,  360,  390,  420,  480,  540,  570,  600,  630,  660,  720,  780,
     840
];   // minutes
```

- [ ] **Step B2.2: HTML for picker modal**

```html
<div id="tz-modal" role="dialog" aria-modal="true" aria-labelledby="tz-modal-heading">
    <div id="tz-modal-card">
        <div id="tz-modal-heading">Select your time zone</div>
        <p>Times in the app will be shown in this zone. Internal calculations stay in UT.</p>
        <div id="tz-modal-list"></div>
        <button id="tz-system-btn" type="button">Use system time zone</button>
        <button id="tz-cancel-btn" type="button">Cancel</button>
    </div>
</div>
```

- [ ] **Step B2.3: First-launch flow**

```javascript
function initTimeZone() {
    let stored = loadStoredZone();
    if (stored === null) {
        const sys = detectSystemTimeZone();
        if (sys) { saveStoredZone('system'); stored = 'system'; }
        else     { showTzPicker(/* firstRun */ true); }
    }
}
```

- [ ] **Step B2.4: Make existing `refreshTimeDisplay` and picker handlers use local-zone helpers**

Swap calls:
- `formatUT(d)` → `formatLocal(d, offsetMin)`
- `formatForInput(d)` → `formatForInputLocal(d, offsetMin)`
- `parseFromInput(value)` → `parseFromLocalInput(value, offsetMin)`

Where `offsetMin = resolveEffectiveOffsetMin()`. Re-evaluate on every tick (1 Hz LIVE refresh) so DST changes are picked up.

- [ ] **Step B2.5: Tappable zone chip in time-display**

Add small clickable element next to the existing LIVE/JUMP tag showing current offset (e.g. `UTC+01:00`). Tap opens `tz-modal`.

### Task B3: On-device verification

```bash
./gradlew.bat installDebug
# Verify: app launches showing local time (no prompt if system zone resolves).
# Tap zone chip → picker opens → pick UTC+05:30 → display flips to that zone.
# Re-launch → previously chosen zone still in effect.
```

---

## Phase C: Info icon + user guide modal

### Task C1: Add info icon next to warning triangle

**Files:**
- Modify: `app/src/main/assets/index.html` (HTML inside `#time-panel`, just after `#warning-icon`)

- [ ] **Step C1.1: Add SVG info icon**

```html
<div style="display:flex; gap:6px; align-self:flex-start;">
    <button id="warning-icon" type="button" aria-label="Accuracy notice" title="Accuracy notice">
        <!-- existing triangle SVG -->
    </button>
    <button id="info-icon" type="button" aria-label="App guide" title="App guide">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <circle cx="12" cy="12" r="10.4" fill="rgba(40,90,200,0.15)" stroke="#3a7ad9" stroke-width="1.6"/>
            <text x="12" y="17.5" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="#3a7ad9">i</text>
        </svg>
    </button>
</div>
```

CSS: same `#warning-icon` styling pattern, with blue colour palette for `#info-icon`.

### Task C2: Guide content module

**Files:**
- Create: `app/src/main/assets/js/UserGuide.js`

- [ ] **Step C2.1: Define content as structured array**

```javascript
// Each section: { title, body, subsections? }
// body / subsection bodies are HTML strings (controlled, no user input).
export const GUIDE_SECTIONS = [
    {
        title: 'Getting Around',
        body: '',
        subsections: [
            { title: 'Move the camera', body: 'Drag with one finger to orbit. Pinch with two fingers to zoom in or out. Drag with two fingers to pan sideways.' },
            { title: 'Jump to a body',  body: 'Tap any planet, moon, or the Sun to fly the camera over to it. Use the “Jump to Body…” dropdown in the top-left for a quick alphabetical list.' },
            { title: 'Reset the view',  body: 'Tap “Reset View” (top-left) to fly back out to the whole solar system.' }
        ]
    },
    {
        title: 'Time Travel',
        body: '',
        subsections: [
            { title: 'Live time vs. Jump time', body: 'By default the app shows where everything <em>is right now</em> (LIVE, in green). When you change the time you switch to JUMP mode (in amber) — the world freezes at that moment.' },
            { title: 'Quick nudges',   body: 'The −/+ buttons jump backward or forward by hour, day, week, month, year, or decade. Tap once for a single jump. Hold any button for about ¾ of a second to start auto-repeat (4 jumps per second) — release to stop.' },
            { title: 'Pick a date',    body: 'Tap the date/time field to open your phone’s native picker and jump to any moment.' },
            { title: 'Back to live',   body: 'Tap the green LIVE button to return to real-time.' }
        ]
    },
    {
        title: 'What You’re Looking At',
        body: '',
        subsections: [
            { title: 'Planet positions',  body: 'Every planet sits at its real position in its orbit, scaled down to fit the screen. The orbital paths are the faint grey rings.' },
            { title: 'Moons',             body: 'Each major moon orbits its parent planet at the right relative direction. Moon distances within a system are roughly proportional, but heavily-distant moons (like Saturn’s Iapetus) are pulled in a bit so they fit.' },
            { title: 'Labels',            body: 'Body names appear next to the bigger objects. They quietly fade out when they’re behind another body, when you zoom too far away, or when two labels would otherwise sit on top of each other.' },
            { title: 'Sun lighting',      body: 'The Sun lights every body realistically — you’ll see day/night sides correctly as bodies rotate.' }
        ]
    },
    {
        title: 'Time Zones',
        body: '',
        subsections: [
            { title: 'Default zone', body: 'On first launch the app uses your phone’s system time zone. If the system zone can’t be detected, you’ll be asked to pick one.' },
            { title: 'Change zone',  body: 'Tap the zone tag (UTC±HH:MM) next to the LIVE/JUMP indicator to switch. Your choice is remembered.' }
        ]
    },
    {
        title: 'Icons in the Corner',
        body: 'A small ⚠ triangle and an ⓘ circle sit just above the time controls. The triangle is the accuracy notice — tap it for a reminder that distances are scaled. The ⓘ opens this guide.'
    },
    {
        title: 'Limitations',
        body: 'This is an indicative guide, not an astronomical instrument. Planet sizes, distances, and a few outer-moon orbits are visually compressed so everything fits on screen. Positions of all major bodies match real-world ephemerides to within about a degree.'
    }
];
```

- [ ] **Step C2.2: Render-to-DOM helper**

```javascript
export function renderGuide(container) {
    container.innerHTML = '';
    for (const sec of GUIDE_SECTIONS) {
        const det = document.createElement('details');
        det.className = 'guide-section';
        const sum = document.createElement('summary');
        sum.textContent = sec.title;
        det.appendChild(sum);
        if (sec.body) {
            const p = document.createElement('p');
            p.innerHTML = sec.body;
            det.appendChild(p);
        }
        if (sec.subsections) {
            for (const sub of sec.subsections) {
                const h = document.createElement('h4'); h.textContent = sub.title;
                const p = document.createElement('p'); p.innerHTML = sub.body;
                det.appendChild(h); det.appendChild(p);
            }
        }
        container.appendChild(det);
    }
}
```

### Task C3: Guide modal HTML + CSS + open/close wiring

**Files:**
- Modify: `app/src/main/assets/index.html`

- [ ] **Step C3.1: Add modal HTML next to existing warning-modal**

```html
<div id="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-modal-heading">
    <div id="info-modal-card">
        <div id="info-modal-heading">App Guide</div>
        <div id="info-modal-body"></div>
        <button id="info-modal-close" type="button">Close</button>
    </div>
</div>
```

- [ ] **Step C3.2: CSS — accordion makes "tap to open/close" obvious for non-technical users**

```css
#info-modal { /* same backdrop style as warning-modal */ }
#info-modal-card { background: #1a1a1a; max-width: min(480px, calc(100vw - 48px));
    max-height: calc(100vh - 64px); overflow-y: auto; padding: 18px 20px; border-radius: 10px;
    border: 1px solid rgba(58, 122, 217, 0.6); color: rgba(255,255,255,0.92); }
#info-modal-heading { font-size: 16px; font-weight: 700; color: #6fa9ff; letter-spacing: 1.5px;
    text-transform: uppercase; margin-bottom: 8px; }
.guide-section { border-bottom: 1px solid rgba(255,255,255,0.08); padding: 8px 0; }
.guide-section > summary { cursor: pointer; font-size: 14px; font-weight: 600; padding: 6px 0;
    list-style: none; display: flex; justify-content: space-between; align-items: center; }
.guide-section > summary::after { content: '▸'; transition: transform 0.15s; color: #6fa9ff; }
.guide-section[open] > summary::after { transform: rotate(90deg); }
.guide-section p { font-size: 13px; line-height: 1.5; margin: 6px 0; }
.guide-section h4 { font-size: 13px; font-weight: 600; color: #c8d8f0; margin: 8px 0 2px; }
```

- [ ] **Step C3.3: Wire open/close**

```javascript
import { renderGuide } from './js/UserGuide.js';
const infoIcon  = document.getElementById('info-icon');
const infoModal = document.getElementById('info-modal');
const infoClose = document.getElementById('info-modal-close');
let infoRendered = false;
infoIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!infoRendered) { renderGuide(document.getElementById('info-modal-body')); infoRendered = true; }
    infoModal.classList.add('visible');
});
infoClose.addEventListener('click', () => infoModal.classList.remove('visible'));
infoModal.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.classList.remove('visible'); });
```

---

## Phase D: Label-overlap fade

### Task D1: LabelOverlap module

**Files:**
- Create: `app/src/main/assets/js/LabelOverlap.js`
- Create: `tests/label-overlap.test.mjs`

- [ ] **Step D1.1: Write failing test for the pure overlap-detector**

```javascript
// tests/label-overlap.test.mjs
import { computeHiddenByOverlap } from '../app/src/main/assets/js/LabelOverlap.js';

// Given a list of {id, rect:{x,y,w,h}, renderedRadius}, returns set of ids
// that should be hidden because they overlap a LARGER body's label.
const labels = [
    { id: 'Sun',     rect: { x: 100, y: 100, w: 30, h: 14 }, renderedRadius: 80 },
    { id: 'Mercury', rect: { x: 110, y: 105, w: 50, h: 14 }, renderedRadius:  6 },
    { id: 'Mars',    rect: { x: 200, y: 200, w: 30, h: 14 }, renderedRadius: 12 }
];
const hidden = computeHiddenByOverlap(labels);
console.log('hidden:', [...hidden]);
if (!hidden.has('Mercury')) { console.error('FAIL: Mercury should be hidden behind Sun'); process.exit(1); }
if (hidden.has('Sun'))     { console.error('FAIL: Sun should NOT be hidden'); process.exit(1); }
if (hidden.has('Mars'))    { console.error('FAIL: Mars does not overlap, should not be hidden'); process.exit(1); }
console.log('PASS: pairwise smallest-hides logic');
```

- [ ] **Step D1.2: Implement `computeHiddenByOverlap`**

```javascript
// app/src/main/assets/js/LabelOverlap.js
function rectsOverlap(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
/** Returns Set of label ids that should be hidden because they overlap a
 *  label belonging to a body with a STRICTLY LARGER on-screen rendered
 *  radius. When 3+ labels mutually overlap, only the smallest one is hidden
 *  (the middle and largest both stay) — this is iterative pairwise. */
export function computeHiddenByOverlap(labels) {
    const hidden = new Set();
    for (let i = 0; i < labels.length; i++) {
        const a = labels[i]; if (hidden.has(a.id)) continue;
        for (let j = 0; j < labels.length; j++) {
            if (i === j) continue;
            const b = labels[j]; if (hidden.has(b.id)) continue;
            if (rectsOverlap(a.rect, b.rect)) {
                if (a.renderedRadius > b.renderedRadius)      hidden.add(b.id);
                else if (b.renderedRadius > a.renderedRadius) hidden.add(a.id);
                // ties: leave both visible
            }
        }
    }
    return hidden;
}
```

- [ ] **Step D1.3: Run test (expect PASS after implementation)**

```bash
node tests/label-overlap.test.mjs
```

### Task D2: Per-frame integration

**Files:**
- Modify: `app/src/main/assets/index.html` (animate loop, after CSS2D render is queued)

- [ ] **Step D2.1: Compute on-screen radius for each visible body**

For each labelled body, compute the world-space radius projected to screen-space pixels. Three.js: `screenRadius = bodyVisualRadius * (rendererHeight / 2) / Math.tan((camera.fov/2) * DEG2RAD) / cameraDistanceToBody`.

- [ ] **Step D2.2: Throttled per-frame call**

In animate loop, every 6 frames (~10 Hz at 60 fps to keep cost trivial):

```javascript
if (frameCount % 6 === 0) {
    const labelInfo = [];
    for (const lbl of labelsList) {
        if (!lbl.element) continue;
        // skip if already hidden by .hidden-label (zoom or occlusion).
        if (lbl.element.classList.contains('hidden-label')) {
            lbl.element.classList.remove('label-overlapped');
            continue;
        }
        const r = lbl.element.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        labelInfo.push({
            id: lbl.bodyName,
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            renderedRadius: lbl.cachedScreenRadius || 1,
            element: lbl.element
        });
    }
    const hidden = computeHiddenByOverlap(labelInfo);
    for (const li of labelInfo) {
        li.element.classList.toggle('label-overlapped', hidden.has(li.id));
    }
}
```

- [ ] **Step D2.3: CSS — parallel hide class**

```css
.planet-label.label-overlapped {
    opacity: 0 !important;
}
```

`!important` is fine here — it stacks with the existing `.hidden-label.opacity:0`. Either class hides the label; both can be present without conflict.

### Task D3: On-device check

```bash
./gradlew.bat installDebug
# Verify: at default zoom, Sun/Mercury/Mars labels no longer overlap.
# Verify: zoom in → label-overlapped fades out, others appear correctly.
# Verify: behind-body fade still works (e.g. Earth Moon when behind Earth).
```

---

## Final Task: Single commit + push

- [ ] **Step F.1: Run full regression suite**

```bash
node tests/saturn-scaling.test.mjs
node tests/moon-frame-fix.test.mjs
node tests/all-moons-spotcheck.mjs
node tests/overlap-check.mjs   # informational, may show pre-existing analytical OVERLAPs we accept
node tests/time-override-extras.test.mjs
node tests/label-overlap.test.mjs
```

All tests except `overlap-check.mjs` (which is analytical-only) must pass. The Mimas-vs-rings entry in overlap-check is now resolved at runtime by `OverlapResolver`, so the static check is informational.

- [ ] **Step F.2: Single combined commit**

```bash
git add app/src/main/assets/js/TimeOverride.js \
        app/src/main/assets/js/LabelOverlap.js \
        app/src/main/assets/js/UserGuide.js \
        app/src/main/assets/index.html \
        tests/time-override-extras.test.mjs \
        tests/label-overlap.test.mjs \
        docs/superpowers/plans/2026-05-03-ux-pack-time-zones-info-overlap.md

git commit -m "UX pack: 12 time-jump nudges with hold-repeat, time-zone picker, info guide modal, label-overlap fade"
git push origin main
```

---

## Self-review notes

- **Spec coverage:**
  - Time-shift extras (1w, 1y, 1dec) → A1, A2 ✓
  - Hold-to-repeat (750 ms, 4 Hz) → A3 ✓
  - Info icon + guide → C1, C2, C3 ✓ (sections cover touch, time, what's on screen, time zones, icons, limitations)
  - Label-overlap fade → D1, D2 (smallest pairwise, parallel class for stacking) ✓
  - Time zone (system default + 32-entry picker, persistence) → B1, B2 ✓
- **Risk to existing math:** zero — every change is presentation-layer only.
- **Risk to existing label logic:** mitigated by parallel `.label-overlapped` class. Existing `.hidden-label` semantics unchanged.
- **Mobile UX:** 12-button grid wraps to 2 rows; modals use `max-width: min(480px, viewport−48px)` and scroll; info icon ~26 px touch target.
