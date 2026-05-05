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
        private val foldRefreshRunnable = Runnable {
            // Trigger widget refresh through the existing scheduleWidget
            // path — uses enqueueUniqueWork(REPLACE) so concurrent
            // enqueues for the same widget collapse cleanly.
            val mgr = AppWidgetManager.getInstance(applicationContext)
            val provider = ComponentName(applicationContext, SolarSystemAppWidgetProvider::class.java)
            for (id in mgr.getAppWidgetIds(provider)) {
                SolarSystemAppWidgetProvider.scheduleWidget(applicationContext, id, runImmediately = true)
            }
            // Also re-render this wallpaper engine itself so the active
            // surface picks up the new dimensions on the new display.
            renderAndPaint()
        }
        private val displayListener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) = scheduleFoldRefresh()
            override fun onDisplayRemoved(displayId: Int) = scheduleFoldRefresh()
            override fun onDisplayChanged(displayId: Int) = scheduleFoldRefresh()
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
                }
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
