package com.livesolar.solarsystem

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder

/**
 * Base live-wallpaper service that paints the chromeless solar system
 * every 10 minutes. Subclasses pick a namespace + default vertical
 * camera offset so home and lock screens can be configured separately.
 *
 * On reboot, Android re-creates the engine automatically when this
 * service is the user's selected wallpaper, so no BOOT_COMPLETED
 * receiver is needed.
 */
abstract class SolarSystemWallpaperService : WallpaperService() {

    abstract fun namespace(): String
    abstract fun defaultOffsetY(): Float
    /**
     * Whether this service should register a DisplayManager.DisplayListener
     * for fold-refresh. ONLY ONE service should return true per app —
     * otherwise the listener fires twice per display event and we double-
     * enqueue widget refreshes. Home is the canonical owner.
     */
    open fun ownsFoldRefresh(): Boolean = false

    override fun onCreateEngine(): Engine = SolarEngine()

    inner class SolarEngine : Engine() {
        private val handler = Handler(Looper.getMainLooper())
        private var widthPx = 0
        private var heightPx = 0
        private var visible = false
        private var lastBitmap: Bitmap? = null
        private var lastParams: String? = null
        private var rendering = false
        private val refreshIntervalMs = 10L * 60 * 1000

        private val refreshRunnable = object : Runnable {
            override fun run() {
                renderAndPaint()
                if (visible) handler.postDelayed(this, refreshIntervalMs)
            }
        }

        // Fold-refresh: DisplayManager.DisplayListener with debounce.
        // Why debounce: a single fold/unfold on the Z Fold 6 fires
        // displayAdded + displayChanged + displayChanged… (5-7 events
        // within ~200ms). Without debounce the listener would enqueue
        // a widget refresh per event, fan-out N renders concurrently,
        // exhaust the system VirtualDisplay budget, and crash with
        // 'createVirtualDisplay returned null' (root cause of the
        // earlier force-close loop). Collapsing all events within a
        // 500ms quiet window into a SINGLE trigger keeps us inside
        // the system's resource limits.
        // Why ownsFoldRefresh(): only the home service registers, so
        // we don't fire twice per display event when the user has both
        // home and lock services bound.
        private val displayManager by lazy {
            applicationContext.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        }
        private val foldRefreshDebounceMs = 500L
        // Per-display size cache. onDisplayChanged fires for ANY display
        // property change — brightness, refresh rate, doze, even active
        // wake state — most of which are NOT folds and shouldn't trigger
        // a re-render. Filtering to actual size deltas cuts out the noisy
        // events that otherwise create a feedback loop where each render
        // toggles screen state and re-fires the listener.
        private val displaySizes = HashMap<Int, android.graphics.Point>()
        private val foldRefreshRunnable = Runnable {
            val mgr = AppWidgetManager.getInstance(applicationContext)
            val provider = ComponentName(applicationContext, SolarSystemAppWidgetProvider::class.java)
            for (id in mgr.getAppWidgetIds(provider)) {
                SolarSystemAppWidgetProvider.scheduleWidget(applicationContext, id, runImmediately = true)
            }
            // No engine re-render here: onSurfaceChanged fires anyway when
            // the surface dimensions actually change after a fold; calling
            // renderAndPaint from this runnable risked piling on a second
            // WebView render concurrent with the surface-changed one and
            // contributed to the 'main app flickers white/black' feedback
            // loop the user observed.
        }
        // Our own virtual displays are named "SolarRenderer-<nanoTime>" by
        // WebViewBitmapRenderer.render. They get added/removed every render
        // cycle. If the listener reacts to those events it forms a feedback
        // loop: render -> VD added -> fold-refresh trigger -> renderAndPaint
        // -> render -> VD added -> ... ad infinitum, observed as 'main app
        // flickers white/black, stuck on loading screen' on the user's
        // device. Track which display IDs are ours so we can ignore them.
        private val ourVirtualIds = HashSet<Int>()
        private fun isOurVirtual(displayId: Int): Boolean {
            if (ourVirtualIds.contains(displayId)) return true
            val d = try { displayManager.getDisplay(displayId) } catch (_: Throwable) { null }
                ?: return false
            if (d.name?.startsWith("SolarRenderer-") == true) {
                ourVirtualIds.add(displayId)
                return true
            }
            return false
        }
        private val displayListener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) {
                if (isOurVirtual(displayId)) return
                cacheDisplaySize(displayId)
                scheduleFoldRefresh()
            }
            override fun onDisplayRemoved(displayId: Int) {
                if (ourVirtualIds.remove(displayId)) return
                displaySizes.remove(displayId)
                scheduleFoldRefresh()
            }
            override fun onDisplayChanged(displayId: Int) {
                if (isOurVirtual(displayId)) return
                if (cacheDisplaySize(displayId)) scheduleFoldRefresh()
            }
        }
        // Returns true if the display's real size changed since the last
        // observation (i.e. a true fold/unfold dimension event), false if
        // unchanged or unreadable. Updates the cache as a side effect.
        private fun cacheDisplaySize(displayId: Int): Boolean {
            val d = try { displayManager.getDisplay(displayId) } catch (_: Throwable) { null }
                ?: return false
            val newSize = android.graphics.Point().also {
                @Suppress("DEPRECATION")
                d.getRealSize(it)
            }
            val prev = displaySizes[displayId]
            displaySizes[displayId] = newSize
            return prev == null || prev != newSize
        }
        private fun scheduleFoldRefresh() {
            handler.removeCallbacks(foldRefreshRunnable)
            handler.postDelayed(foldRefreshRunnable, foldRefreshDebounceMs)
        }

        override fun onCreate(surfaceHolder: SurfaceHolder?) {
            super.onCreate(surfaceHolder)
            if (ownsFoldRefresh()) {
                try { displayManager.registerDisplayListener(displayListener, handler) } catch (_: Throwable) {}
            }
            // Disk-cache recovery: load the previous render's bitmap so the
            // very first paintToSurface after a process restart (e.g. user
            // force-stopped the app from Settings, system OOM-killed the
            // :wallpaper process, etc.) can show the prior wallpaper within
            // ~50 ms instead of leaving the surface black until the async
            // WebView render finishes ~4-8 s later. The fresh render still
            // happens via onSurfaceChanged → renderAndPaint, just behind the
            // already-painted cached bitmap.
            try {
                val cacheFile = java.io.File(applicationContext.filesDir, "wallpaper_${namespace()}.webp")
                if (cacheFile.exists()) {
                    lastBitmap = android.graphics.BitmapFactory.decodeFile(cacheFile.absolutePath)
                }
            } catch (_: Throwable) { /* best-effort; cache miss falls back to default */ }
        }

        override fun onSurfaceChanged(holder: SurfaceHolder?, format: Int, w: Int, h: Int) {
            super.onSurfaceChanged(holder, format, w, h)
            widthPx = w; heightPx = h
            renderAndPaint()
        }

        override fun onVisibilityChanged(v: Boolean) {
            super.onVisibilityChanged(v)
            visible = v
            if (v) {
                // If user changed offset/labels while the wallpaper was hidden,
                // re-render rather than re-painting the stale cached bitmap.
                val current = currentParams()
                if (current != lastParams) {
                    renderAndPaint()
                } else {
                    paintToSurface(lastBitmap)
                }
                handler.removeCallbacks(refreshRunnable)
                handler.postDelayed(refreshRunnable, refreshIntervalMs)
            } else {
                handler.removeCallbacks(refreshRunnable)
            }
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder?) {
            super.onSurfaceDestroyed(holder)
            handler.removeCallbacks(refreshRunnable)
        }

        override fun onDestroy() {
            handler.removeCallbacks(refreshRunnable)
            handler.removeCallbacks(foldRefreshRunnable)
            if (ownsFoldRefresh()) {
                try { displayManager.unregisterDisplayListener(displayListener) } catch (_: Throwable) {}
            }
            lastBitmap = null
            super.onDestroy()
        }

        private fun currentParams(): String =
            SurfaceSettings(applicationContext, namespace(), defaultOffsetY()).urlParams("wallpaper")

        private fun renderAndPaint() {
            if (widthPx <= 0 || heightPx <= 0 || rendering) return
            rendering = true
            val params = currentParams()
            WebViewBitmapRenderer.render(applicationContext, widthPx, heightPx, params) { bm ->
                rendering = false
                if (bm != null) {
                    lastBitmap = bm
                    // Only mark these params 'last seen' once we successfully
                    // produced a bitmap. If we set lastParams pre-render and
                    // the render returns null (e.g. createVirtualDisplay
                    // exhausted), the next onVisibilityChanged would compute
                    // currentParams() == lastParams and skip the retry — the
                    // wallpaper would be permanently stuck on the previous
                    // bitmap. Setting after success ensures stale renders
                    // get retried on the next visibility cycle.
                    lastParams = params
                    paintToSurface(bm)
                    cacheBitmapToDisk(bm)
                }
            }
        }

        // Persist the most recent successful render to filesDir so the next
        // process start (after force-stop / OOM kill / reboot) can show it
        // immediately on Engine.onCreate. WebP at quality 80 keeps the file
        // ~150-300 KB on a typical inner-display render. Fire-and-forget on
        // the engine's main handler — no caller blocks on this.
        private fun cacheBitmapToDisk(bm: Bitmap) {
            handler.post {
                try {
                    val cacheFile = java.io.File(applicationContext.filesDir, "wallpaper_${namespace()}.webp")
                    cacheFile.outputStream().use { os ->
                        @Suppress("DEPRECATION")
                        bm.compress(Bitmap.CompressFormat.WEBP, 80, os)
                    }
                } catch (_: Throwable) { /* best-effort; cache miss is acceptable */ }
            }
        }

        private fun paintToSurface(bm: Bitmap?) {
            val holder = surfaceHolder ?: return
            if (!holder.surface.isValid) return
            var canvas: Canvas? = null
            try {
                canvas = holder.lockCanvas() ?: return
                canvas.drawColor(Color.BLACK)
                if (bm != null) canvas.drawBitmap(bm, 0f, 0f, null)
            } catch (_: Throwable) {
                // best-effort; engine will retry on next visibility/refresh
            } finally {
                try { if (canvas != null) holder.unlockCanvasAndPost(canvas) } catch (_: Throwable) {}
            }
        }
    }
}

class SolarSystemHomeWallpaperService : SolarSystemWallpaperService() {
    override fun namespace() = SurfaceSettings.HOME_WALLPAPER_NAMESPACE
    override fun defaultOffsetY() = SurfaceSettings.DEFAULT_HOME_OFFSET_Y
    // Home owns the fold-refresh listener. Lock skips to avoid double-fire.
    override fun ownsFoldRefresh() = true
}

class SolarSystemLockWallpaperService : SolarSystemWallpaperService() {
    override fun namespace() = SurfaceSettings.LOCK_WALLPAPER_NAMESPACE
    override fun defaultOffsetY() = SurfaceSettings.DEFAULT_LOCK_OFFSET_Y
}
