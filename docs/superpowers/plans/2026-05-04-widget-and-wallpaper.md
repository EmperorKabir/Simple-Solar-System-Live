# Widget + Live Wallpaper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement.

**Goal:** Add (1) a resizable home-screen widget and (2) a live wallpaper (also usable on lock screen) that show the same chromeless solar-system view as the main app, refresh every 10 minutes (and on boot for wallpaper), with per-surface user settings for vertical camera offset (0–70 % in 10 % steps) and label visibility (on / off).

**Architecture:** Add new Android components (AppWidgetProvider, WallpaperService, two configuration Activities) that load the existing `index.html` in a hidden `WebView` with URL params (`?surface=widget|wallpaper&offsetY=0.X&labels=on|off`). The HTML reads the params, hides chrome, shrinks the renderer to occupy only the bottom `(1−offsetY)` of the canvas, and toggles label CSS. Widget bitmap captured via `WebView.draw(canvas)`; wallpaper engine paints same bitmap onto its surface. **Main app is unaffected** — when `surface` param is absent, default behaviour is identical to today.

**Tech Stack:** Kotlin, Android `AppWidgetProvider` + `WorkManager` periodic refresh, `WallpaperService` + `Engine` with `Handler.postDelayed` cadence, hidden `WebView.draw(Canvas)` for bitmap capture, `SharedPreferences` per surface, Three.js renderer resize via existing `resize` listener.

---

## Iron rules

1. **NO regressions in the main app.** If the `surface` URL param is absent, behaviour is byte-for-byte identical.
2. **Widget and wallpaper share a single rendering helper** (`WebViewBitmapRenderer.kt`) — DRY.
3. **Per-surface settings** (offsetY, labels) stored in `SharedPreferences` under namespaces `widget_<id>` and `wallpaper`.
4. **No new permissions.** Widget config + wallpaper engine work without manifest permissions beyond what we already have.
5. **Single combined commit** at the end after on-device verification.

---

## File structure

| File | Role |
|---|---|
| `app/src/main/assets/index.html` | URL-param parser sets `body.dataset.surface` / `body.dataset.labels`; CSS hides chrome and labels under those data attrs; renderer resize listener honours `cameraOffsetY`. |
| `app/src/main/AndroidManifest.xml` | Add `<receiver>` for AppWidgetProvider, `<service>` for WallpaperService, two `<activity>` for config UIs. |
| `app/src/main/res/xml/widget_info.xml` | NEW — widget metadata (resize modes, sizes, preview, config Activity). |
| `app/src/main/res/xml/wallpaper.xml` | NEW — wallpaper metadata (settings Activity, thumbnail, description). |
| `app/src/main/res/layout/widget_initial.xml` | NEW — `RemoteViews` layout: a single `ImageView` filling the widget area + loading-text fallback. |
| `app/src/main/res/layout/activity_surface_settings.xml` | NEW — settings UI: spinner for offsetY (0–70 % in 10 %), switch for labels. Used by both widget and wallpaper Activities. |
| `app/src/main/res/drawable/widget_preview.xml` | NEW — small static preview vector for the widget picker. |
| `app/src/main/res/drawable/wallpaper_thumbnail.xml` | NEW — small static preview for live-wallpaper picker. |
| `app/src/main/res/values/strings.xml` | NEW — strings for widget label, wallpaper title/description, settings labels. |
| `app/src/main/java/com/livesolar/solarsystem/SurfaceSettings.kt` | NEW — SharedPreferences read/write for `offsetY` (0.0..0.7) and `labelsEnabled` (true/false), per surface namespace. |
| `app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt` | NEW — given (width, height, urlParams), creates an offscreen WebView, loads index.html, waits for first render, returns Bitmap via callback. |
| `app/src/main/java/com/livesolar/solarsystem/SolarSystemAppWidgetProvider.kt` | NEW — onUpdate / onAppWidgetOptionsChanged / onDeleted; schedules periodic WorkManager refresh per widget id. |
| `app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt` | NEW — Worker class: renders one bitmap, pushes RemoteViews with the bitmap into AppWidgetManager. |
| `app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetConfigActivity.kt` | NEW — extends `SurfaceSettingsActivity`; saves to `widget_<id>` namespace; returns the AppWidget id in result intent. |
| `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt` | NEW — extends `WallpaperService`; `Engine` schedules a 10-min Handler tick + renders bitmap on each tick, paints to Surface. |
| `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperConfigActivity.kt` | NEW — extends `SurfaceSettingsActivity`; saves to `wallpaper` namespace. |

---

## Phase A: HTML / JS surface-mode plumbing

### Task A1: URL-param reader + body data attrs

**Files:**
- Modify: `app/src/main/assets/index.html`

- [ ] **Step A1.1: Add early-startup param parser** (right after `<script type="module">` opens, before any other JS):

```javascript
// ── Surface-mode URL params (widget / wallpaper). When absent, behaviour is
// identical to today (full app). When set, hides chrome + adjusts renderer.
const _surfaceParams = new URLSearchParams(window.location.search);
const SURFACE = _surfaceParams.get('surface') || 'main';      // 'main' | 'widget' | 'wallpaper'
const LABELS_ENABLED = _surfaceParams.get('labels') !== 'off';
const CAMERA_OFFSET_Y = (() => {
    const v = parseFloat(_surfaceParams.get('offsetY') || '0');
    return Number.isFinite(v) ? Math.min(0.7, Math.max(0, v)) : 0;
})();
document.body.dataset.surface = SURFACE;
document.body.dataset.labels = LABELS_ENABLED ? 'on' : 'off';
```

- [ ] **Step A1.2: CSS — hide chrome on non-main surfaces and labels on labels=off**

```css
/* Surface modes (widget / wallpaper) — main app behaviour unchanged. */
body[data-surface="widget"] #header-layer,
body[data-surface="widget"] #hud-telemetry,
body[data-surface="widget"] #time-panel,
body[data-surface="widget"] #app-loader,
body[data-surface="widget"] #warning-modal,
body[data-surface="widget"] #info-modal,
body[data-surface="widget"] #tz-modal,
body[data-surface="wallpaper"] #header-layer,
body[data-surface="wallpaper"] #hud-telemetry,
body[data-surface="wallpaper"] #time-panel,
body[data-surface="wallpaper"] #app-loader,
body[data-surface="wallpaper"] #warning-modal,
body[data-surface="wallpaper"] #info-modal,
body[data-surface="wallpaper"] #tz-modal {
    display: none !important;
}
body[data-labels="off"] .planet-label {
    display: none !important;
}
/* Surface-mode canvas pinned to bottom of viewport so the top portion
   (camera offset region) is empty (matches body's black bg). */
body[data-surface="widget"] canvas,
body[data-surface="wallpaper"] canvas {
    position: absolute !important;
    left: 0 !important;
    bottom: 0 !important;
    top: auto !important;
}
```

- [ ] **Step A1.3: Renderer / labelRenderer height honours cameraOffsetY**

In the existing `window.addEventListener('resize', ...)` block AND immediately after renderer setup, change all `setSize(window.innerWidth, window.innerHeight)` calls to use a helper:

```javascript
function _renderHeight() { return window.innerHeight * (1 - CAMERA_OFFSET_Y); }
function _applyRenderSize() {
    const w = window.innerWidth, h = _renderHeight();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
// Replace existing resize listener body with: _applyRenderSize();
// Also call _applyRenderSize() once during initial setup.
```

For surface=main, `CAMERA_OFFSET_Y = 0` so `_renderHeight() === window.innerHeight` — identical to current behaviour.

- [ ] **Step A1.4: Test in browser (no Android needed)**

Open `file:///.../index.html?surface=widget&offsetY=0.3&labels=off` in Chrome:
- All UI chrome should be invisible
- Canvas occupies bottom 70 % of viewport
- No labels visible

Open `index.html` (no params) — full app renders exactly as today.

---

## Phase B: Per-surface settings + bitmap renderer

### Task B1: SurfaceSettings.kt

**Files:**
- Create: `app/src/main/java/com/livesolar/solarsystem/SurfaceSettings.kt`

```kotlin
package com.livesolar.solarsystem

import android.content.Context
import android.content.SharedPreferences

/**
 * Per-surface user preferences (widget instance or live wallpaper).
 * Stored in distinct SharedPreferences files so widget and wallpaper
 * configs never collide.
 */
class SurfaceSettings(context: Context, namespace: String) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("slss.$namespace", Context.MODE_PRIVATE)

    var offsetY: Float
        get() = prefs.getFloat("offsetY", DEFAULT_OFFSET_Y)
        set(value) = prefs.edit().putFloat("offsetY", value.coerceIn(0f, 0.7f)).apply()

    var labelsEnabled: Boolean
        get() = prefs.getBoolean("labels", true)
        set(value) = prefs.edit().putBoolean("labels", value).apply()

    /** URL params for index.html in widget/wallpaper mode. */
    fun urlParams(surface: String): String {
        val o = (offsetY * 10).toInt() / 10f   // round to 0.1 steps
        val l = if (labelsEnabled) "on" else "off"
        return "?surface=$surface&offsetY=$o&labels=$l"
    }

    companion object {
        const val DEFAULT_OFFSET_Y = 0.0f
        fun widgetNamespace(appWidgetId: Int) = "widget_$appWidgetId"
        const val WALLPAPER_NAMESPACE = "wallpaper"
    }
}
```

### Task B2: WebViewBitmapRenderer.kt

**Files:**
- Create: `app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt`

```kotlin
package com.livesolar.solarsystem

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * Renders the chromeless solar-system view at a requested size into a Bitmap.
 *
 * Internally creates an offscreen WebView, loads index.html with the given
 * URL params, waits for the first render frame, draws to a Bitmap, then
 * destroys the WebView. Must be invoked on the main looper.
 */
object WebViewBitmapRenderer {
    private const val FIRST_FRAME_DELAY_MS = 1500L   // wait for textures + first Three.js render

    fun render(
        context: Context,
        widthPx: Int,
        heightPx: Int,
        urlParams: String,
        onResult: (Bitmap?) -> Unit
    ) {
        require(Looper.myLooper() == Looper.getMainLooper()) { "must be called on main thread" }
        if (widthPx <= 0 || heightPx <= 0) { onResult(null); return }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()

        val wv = WebView(context.applicationContext)
        wv.measure(
            View.MeasureSpec.makeMeasureSpec(widthPx, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(heightPx, View.MeasureSpec.EXACTLY)
        )
        wv.layout(0, 0, widthPx, heightPx)
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.settings.useWideViewPort = false
        wv.settings.loadWithOverviewMode = false
        wv.setBackgroundColor(android.graphics.Color.BLACK)
        wv.setLayerType(View.LAYER_TYPE_SOFTWARE, null)   // required for draw(canvas)

        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)
        }
        wv.webChromeClient = WebChromeClient()

        val handler = Handler(Looper.getMainLooper())
        var done = false
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)
            override fun onPageFinished(view: WebView, url: String?) {
                handler.postDelayed({
                    if (done) return@postDelayed; done = true
                    try {
                        val bm = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
                        bm.eraseColor(android.graphics.Color.BLACK)
                        wv.draw(Canvas(bm))
                        onResult(bm)
                    } catch (e: Throwable) {
                        onResult(null)
                    } finally {
                        wv.destroy()
                    }
                }, FIRST_FRAME_DELAY_MS)
            }
        }

        wv.loadUrl("https://appassets.androidplatform.net/assets/index.html$urlParams")
    }
}
```

---

## Phase C: Widget — provider, worker, config Activity

### Task C1: SolarSystemAppWidgetProvider.kt

```kotlin
package com.livesolar.solarsystem

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class SolarSystemAppWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) scheduleWidget(context, id)
    }
    override fun onAppWidgetOptionsChanged(
        context: Context, mgr: AppWidgetManager,
        appWidgetId: Int, newOptions: android.os.Bundle
    ) {
        scheduleWidget(context, appWidgetId, runImmediately = true)
    }
    override fun onDeleted(context: Context, ids: IntArray) {
        val wm = WorkManager.getInstance(context)
        for (id in ids) wm.cancelUniqueWork("widget-refresh-$id")
    }

    companion object {
        fun scheduleWidget(context: Context, appWidgetId: Int, runImmediately: Boolean = true) {
            val data = Data.Builder().putInt("appWidgetId", appWidgetId).build()
            val periodic = PeriodicWorkRequestBuilder<SolarSystemWidgetWorker>(15, TimeUnit.MINUTES)
                .setInputData(data).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "widget-refresh-$appWidgetId",
                ExistingPeriodicWorkPolicy.UPDATE,
                periodic
            )
            if (runImmediately) {
                val once = OneTimeWorkRequestBuilder<SolarSystemWidgetWorker>().setInputData(data).build()
                WorkManager.getInstance(context).enqueue(once)
            }
        }
    }
}
```

Note: WorkManager periodic minimum is 15 min. We use 15 min for the periodic worker (close enough to "10 min" — within Android constraints) plus an immediate one-shot whenever the widget is added/resized so the user sees a fresh render right away.

### Task C2: SolarSystemWidgetWorker.kt

```kotlin
package com.livesolar.solarsystem

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.Bundle
import android.widget.RemoteViews
import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.work.ListenableWorker
import androidx.work.WorkerParameters
import com.google.common.util.concurrent.ListenableFuture
import android.os.Handler
import android.os.Looper

class SolarSystemWidgetWorker(ctx: Context, params: WorkerParameters) : ListenableWorker(ctx, params) {

    override fun startWork(): ListenableFuture<Result> = CallbackToFutureAdapter.getFuture { completer ->
        val appWidgetId = inputData.getInt("appWidgetId", -1)
        if (appWidgetId == -1) { completer.set(Result.failure()); return@getFuture "no-id" }

        val mgr = AppWidgetManager.getInstance(applicationContext)
        val opts: Bundle = mgr.getAppWidgetOptions(appWidgetId)
        val density = applicationContext.resources.displayMetrics.density
        val widthDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 320)
        val heightDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 320)
        val widthPx = (widthDp * density).toInt().coerceAtLeast(1)
        val heightPx = (heightDp * density).toInt().coerceAtLeast(1)

        val settings = SurfaceSettings(applicationContext, SurfaceSettings.widgetNamespace(appWidgetId))
        val params = settings.urlParams("widget")

        Handler(Looper.getMainLooper()).post {
            WebViewBitmapRenderer.render(applicationContext, widthPx, heightPx, params) { bitmap ->
                if (bitmap != null) {
                    val rv = RemoteViews(applicationContext.packageName, R.layout.widget_initial)
                    rv.setImageViewBitmap(R.id.widget_image, bitmap)
                    val tapIntent = android.content.Intent(applicationContext, MainActivity::class.java)
                    val pi = android.app.PendingIntent.getActivity(
                        applicationContext, 0, tapIntent,
                        android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    )
                    rv.setOnClickPendingIntent(R.id.widget_image, pi)
                    mgr.updateAppWidget(appWidgetId, rv)
                }
                completer.set(Result.success())
            }
        }
        "widget-render-$appWidgetId"
    }
}
```

### Task C3: SolarSystemWidgetConfigActivity.kt

A simple Activity shown when the user drops the widget on the home screen. UI: a spinner for offsetY (0 %..70 %), a switch for "Show body labels", a "Done" button. On Done: save settings, schedule widget, finish with `RESULT_OK + EXTRA_APPWIDGET_ID`.

(Implementation block omitted here for brevity — see Step E for the full code; pattern is standard.)

---

## Phase D: Live wallpaper

### Task D1: SolarSystemWallpaperService.kt

```kotlin
package com.livesolar.solarsystem

import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder

class SolarSystemWallpaperService : WallpaperService() {
    override fun onCreateEngine() = SolarEngine()

    inner class SolarEngine : Engine() {
        private val handler = Handler(Looper.getMainLooper())
        private var width = 0
        private var height = 0
        private var visible = false
        private var lastBitmap: android.graphics.Bitmap? = null
        private val refreshRunnable = Runnable { renderAndPaint(); scheduleNext() }

        override fun onSurfaceChanged(holder: SurfaceHolder?, format: Int, w: Int, h: Int) {
            width = w; height = h
            renderAndPaint()
        }
        override fun onVisibilityChanged(v: Boolean) {
            visible = v
            if (v) { renderAndPaint(); scheduleNext() }
            else { handler.removeCallbacks(refreshRunnable) }
        }
        override fun onSurfaceDestroyed(holder: SurfaceHolder?) {
            handler.removeCallbacks(refreshRunnable)
        }

        private fun scheduleNext() {
            handler.removeCallbacks(refreshRunnable)
            handler.postDelayed(refreshRunnable, 10 * 60 * 1000L)   // 10 min
        }
        private fun renderAndPaint() {
            if (width <= 0 || height <= 0) return
            val settings = SurfaceSettings(applicationContext, SurfaceSettings.WALLPAPER_NAMESPACE)
            val params = settings.urlParams("wallpaper")
            WebViewBitmapRenderer.render(applicationContext, width, height, params) { bm ->
                lastBitmap = bm
                paintToSurface()
            }
        }
        private fun paintToSurface() {
            val bm = lastBitmap ?: return
            val holder = surfaceHolder ?: return
            var canvas: android.graphics.Canvas? = null
            try {
                canvas = holder.lockCanvas()
                if (canvas != null) {
                    canvas.drawColor(android.graphics.Color.BLACK)
                    canvas.drawBitmap(bm, 0f, 0f, null)
                }
            } finally {
                if (canvas != null) holder.unlockCanvasAndPost(canvas)
            }
        }
    }
}
```

Boot trigger: free — Android auto-restarts the wallpaper service after device reboot if the user has selected it.

### Task D2: SolarSystemWallpaperConfigActivity.kt

Same pattern as widget config but writes to the `wallpaper` namespace. Reachable via Android wallpaper-picker "Settings" button.

---

## Phase E: Manifest, resources, layouts, strings

(Provided in full at execution time — standard Android boilerplate.)

---

## Phase F: Build, install, smoke-test

- [ ] **Step F.1: Build debug + release** — `./gradlew installDebug` then verify on phone:
  - Long-press home → Widgets → "Simple Live Solar System" → drag to home → config dialog appears → set offset 30 %, labels on → Save
  - Wait ~15 s for first render → solar system appears in widget
  - Tap widget → main app launches normally
  - Resize widget → re-renders at new size
- [ ] **Step F.2: Live wallpaper** — Settings → Wallpaper → Live wallpapers → "Simple Live Solar System" → tap "Settings" → set offset 40 %, labels off → Apply (Home + Lock) → solar system visible on both surfaces with empty top 40 %
- [ ] **Step F.3: Confirm main app unchanged** — open main app → all chrome present, time picker works, all moons render, no regression.

---

## Phase G: Single combined commit

```bash
git add app/src/main/AndroidManifest.xml \
        app/src/main/assets/index.html \
        app/src/main/java/com/livesolar/solarsystem/ \
        app/src/main/res/layout/ \
        app/src/main/res/xml/ \
        app/src/main/res/drawable/widget_preview.xml \
        app/src/main/res/drawable/wallpaper_thumbnail.xml \
        app/src/main/res/values/strings.xml \
        app/build.gradle.kts \
        docs/superpowers/plans/2026-05-04-widget-and-wallpaper.md

git commit -m "feat: home-screen widget + live wallpaper (chromeless solar system, 10-min refresh, per-surface offsetY 0–70% and labels on/off, single WallpaperService for home + lock)"
git push origin main
```

---

## Self-review

- **Spec coverage**: widget ✓, wallpaper ✓, lock screen via single WallpaperService ✓, 10-min cadence (15 min for widget WorkManager + immediate one-shot, 10 min in wallpaper engine) ✓, boot trigger (free for wallpaper, widget refresh restarts via WorkManager) ✓, vertical camera offset 0–70 % in 10 % increments ✓ (spinner with 8 entries), labels on/off ✓ (switch).
- **Main-app safety**: gated entirely on URL `surface` param; without param, behaviour identical.
- **Risks**: WebView in non-Activity context — well-trodden territory but warrants on-device verification at the end of each phase.
