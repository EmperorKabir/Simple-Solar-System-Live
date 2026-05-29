// SLSS_DIAG_TEMPORARY — @JavascriptInterface bridge exposed to the WebView as
// window.SlssLog. Part of the temporary diagnostic logging system (plan §1, §6).
// The event type carried by JS is namespaced "js" implicitly via the
// webview_owner field added here, and the raw payload JSON is merged with the
// Kotlin envelope. Remove with the rest of the diag/ package
// (grep -r SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem.diag

import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * @param owner Identifies which WebView host emitted the event (e.g.
 *   "MainActivity" or "WebViewBitmapRenderer") so widget/wallpaper render JS
 *   logs are separable from the main app's.
 */
internal class SlssLoggerJsBridge(private val owner: String) {

    @JavascriptInterface
    fun event(type: String, payloadJson: String) {
        if (!SlssLogger.enabled) return
        try {
            val payload = if (payloadJson.isBlank()) JSONObject() else JSONObject(payloadJson)
            payload.put("webview_owner", owner)
            val corr = payload.optString("correlation_id", "").ifEmpty { null }
            SlssLogger.logRaw(type, payload, corr)
        } catch (e: Exception) {
            Log.w("SlssDiag", "JS bridge event('$type') parse failed: ${e.message}")
        }
    }

    /** True so JS can cheaply confirm the native bridge is live. */
    @JavascriptInterface
    fun isEnabled(): Boolean = SlssLogger.enabled
}
