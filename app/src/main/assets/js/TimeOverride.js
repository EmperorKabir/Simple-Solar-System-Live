/**
 * TimeOverride.js
 *
 * Optional simulation-time override for the orbital engine. When an
 * override is set, every orbital evaluator that calls getEffectiveJ2000Days()
 * sees the chosen UT instead of the system clock — letting the user "jump
 * to" any moment for verification against external references (Stellarium,
 * Horizons, etc.).
 *
 * No persistence; cleared on reload (default = LIVE).
 *
 * @module TimeOverride
 */

const J2000_EPOCH_JD = 2451545.0;
const UNIX_EPOCH_JD  = 2440587.5;
const MS_PER_DAY     = 86400000.0;

let _overrideMs = null;  // milliseconds since Unix epoch (UT), or null = live

export function setTimeOverride(date) {
    _overrideMs = (date instanceof Date && isFinite(date.getTime())) ? date.getTime() : null;
}

export function clearTimeOverride() { _overrideMs = null; }

export function isLive() { return _overrideMs === null; }

export function getEffectiveDate() {
    return new Date(_overrideMs ?? Date.now());
}

export function getEffectiveJ2000Days() {
    const ms = _overrideMs ?? Date.now();
    return ms / MS_PER_DAY + UNIX_EPOCH_JD - J2000_EPOCH_JD;
}

/** Format Date as "YYYY-MM-DD HH:MM:SS UT" (always UTC, never local). */
export function formatUT(date) {
    const Y = date.getUTCFullYear();
    const M = String(date.getUTCMonth() + 1).padStart(2, '0');
    const D = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}:${s} UT`;
}

/** Format Date for <input type="datetime-local"> value (YYYY-MM-DDTHH:MM:SS, UTC). */
export function formatForInput(date) {
    const Y = date.getUTCFullYear();
    const M = String(date.getUTCMonth() + 1).padStart(2, '0');
    const D = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D}T${h}:${m}:${s}`;
}

/** Parse "YYYY-MM-DDTHH:MM[:SS]" from <input type="datetime-local"> as UT. */
export function parseFromInput(value) {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    return isFinite(d.getTime()) ? d : null;
}

/** Add hours/days/months to a Date as UT (months are calendar-aware). */
export function addUT(date, { hours = 0, days = 0, months = 0 } = {}) {
    const d = new Date(date.getTime());
    if (months) d.setUTCMonth(d.getUTCMonth() + months);
    if (days)   d.setUTCDate(d.getUTCDate() + days);
    if (hours)  d.setUTCHours(d.getUTCHours() + hours);
    return d;
}
