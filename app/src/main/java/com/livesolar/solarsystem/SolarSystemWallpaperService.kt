package com.livesolar.solarsystem

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder

/**
 * Live wallpaper that paints the chromeless solar system every 10 minutes.
 * The same engine works for home and lock screens — Android lets the user
 * pick which surface(s) to apply the wallpaper to.
 *
 * On reboot, Android re-creates the engine automatically if the user has
 * this service selected as their wallpaper, so no BOOT_COMPLETED receiver
 * is needed.
 */
class SolarSystemWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = SolarEngine()

    inner class SolarEngine : Engine() {
        private val handler = Handler(Looper.getMainLooper())
        private var widthPx = 0
        private var heightPx = 0
        private var visible = false
        private var lastBitmap: Bitmap? = null
        private var rendering = false
        private val refreshIntervalMs = 10L * 60 * 1000

        private val refreshRunnable = object : Runnable {
            override fun run() {
                renderAndPaint()
                if (visible) handler.postDelayed(this, refreshIntervalMs)
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
                // Re-paint last known bitmap immediately when becoming visible
                paintToSurface(lastBitmap)
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
            lastBitmap = null
            super.onDestroy()
        }

        private fun renderAndPaint() {
            if (widthPx <= 0 || heightPx <= 0 || rendering) return
            rendering = true
            val settings = SurfaceSettings(applicationContext, SurfaceSettings.WALLPAPER_NAMESPACE)
            val params = settings.urlParams("wallpaper")
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
