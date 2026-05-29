// SLSS_DIAG_TEMPORARY — JS-side diagnostic logging bridge wrapper.
// Part of the temporary diagnostic logging system (plan §1, §6 new JS).
// Calls window.SlssLog.event(type, jsonStr) when the Kotlin @JavascriptInterface
// bridge is present (diagnostic builds); otherwise every function is a cheap
// no-op so non-diagnostic builds pay nothing. Remove with index.html imports
// and the diag/ package (grep -r SLSS_DIAG_TEMPORARY).

const _bridge =
    (typeof window !== 'undefined' && window.SlssLog && typeof window.SlssLog.event === 'function')
        ? window.SlssLog
        : null;

/** True when the native diagnostic bridge is attached. */
export function slssEnabled() {
    return _bridge !== null;
}

/** Emit one event. payload is any JSON-serialisable object. */
export function slssEvent(type, payload) {
    if (!_bridge) return;
    try {
        _bridge.event(type, JSON.stringify(payload));
    } catch (e) {
        // Last-ditch: try to report the failure itself, then give up silently.
        try { _bridge.event('error', JSON.stringify({ severity: 'warn', source: 'js', message: 'slssEvent serialise failed: ' + (e && e.message) })); } catch (_) { /* noop */ }
    }
}

/** Short correlation id for linking a span of related events. */
export function slssCorr() {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID().slice(0, 8);
        }
    } catch (_) { /* fall through */ }
    return 'c' + Math.floor(Math.random() * 1e9).toString(36);
}
