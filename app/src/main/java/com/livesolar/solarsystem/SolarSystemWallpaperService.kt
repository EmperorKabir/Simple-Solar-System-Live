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

        // Listen for display add/remove/change events (fold ↔ unfold on the
        // Z Fold, dock connect/disconnect, external display attach, etc.).
        // When a display change happens we enqueue a refresh for every
        // active widget so the cover/inner-display launchers stop showing
        // stale bitmaps. The wallpaper service itself is always alive while
        // a wallpaper is applied, so this listener gives reliable fold
        // detection without spinning up a foreground service of our own.
        private val displayManager by lazy {
            applicationContext.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        }
        private val displayListener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) = triggerWidgetRefresh()
            override fun onDisplayRemoved(displayId: Int) = triggerWidgetRefresh()
            override fun onDisplayChanged(displayId: Int) = triggerWidgetRefresh()
        }

        override fun onCreate(surfaceHolder: SurfaceHolder?) {
            super.onCreate(surfaceHolder)
            try {
                displayManager.registerDisplayListener(displayListener, handler)
            } catch (_: Throwable) { /* defensive: device may not support DisplayManager */ }
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
            try { displayManager.unregisterDisplayListener(displayListener) } catch (_: Throwable) {}
            handler.removeCallbacks(refreshRunnable)
            lastBitmap = null
            super.onDestroy()
        }

        // Enqueue an expedited widget render for every currently-bound widget.
        // Works through SolarSystemAppWidgetProvider.scheduleWidget so it
        // shares the setExpedited() path that bypasses Freecess/Doze.
        private fun triggerWidgetRefresh() {
            val mgr = AppWidgetManager.getInstance(applicationContext)
            val provider = ComponentName(applicationContext, SolarSystemAppWidgetProvider::class.java)
            val widgetIds = mgr.getAppWidgetIds(provider)
            for (id in widgetIds) {
                SolarSystemAppWidgetProvider.scheduleWidget(applicationContext, id, runImmediately = true)
            }
        }

        private fun currentParams(): String =
            SurfaceSettings(applicationContext, namespace(), defaultOffsetY()).urlParams("wallpaper")

        private fun renderAndPaint() {
            if (widthPx <= 0 || heightPx <= 0 || rendering) return
            rendering = true
            val params = currentParams()
            lastParams = params
            WebViewBitmapRenderer.render(applicationContext, widthPx, heightPx, params) { bm ->
                rendering = false
                if (bm != null) {
                    lastBitmap = bm
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
}

class SolarSystemLockWallpaperService : SolarSystemWallpaperService() {
    override fun namespace() = SurfaceSettings.LOCK_WALLPAPER_NAMESPACE
    override fun defaultOffsetY() = SurfaceSettings.DEFAULT_LOCK_OFFSET_Y
}
