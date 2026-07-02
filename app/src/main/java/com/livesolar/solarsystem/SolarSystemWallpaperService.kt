package com.livesolar.solarsystem

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.RectF
import kotlin.math.max
import kotlin.math.min
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
// SLSS_DIAG_TEMPORARY — wallpaper render + lock-shift diagnostics.
import com.livesolar.solarsystem.diag.SlssLogger
import com.livesolar.solarsystem.diag.SlssCentroidProbe
import com.livesolar.solarsystem.diag.SlssSyntheticEventDetector
import com.livesolar.solarsystem.diag.SlssMetrics

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

    // SLSS_DIAG_TEMPORARY — short surface discriminator for render diagnostics.
    open fun surfaceKind(): String = "home"

    override fun onCreateEngine(): Engine = SolarEngine()

    inner class SolarEngine : Engine() {
        private val handler = Handler(Looper.getMainLooper())
        private var widthPx = 0
        private var heightPx = 0
        private var visible = false
        private var lastBitmap: Bitmap? = null
        private var lastParams: String? = null
        private var rendering = false
        // Dims of the last SUCCESSFUL render — so we only re-render on becoming
        // visible when the surface actually changed size while hidden.
        private var lastRenderW = 0
        private var lastRenderH = 0
        // Bounded auto-retry when a render yields no bitmap (WebGL context lost
        // under the concurrent-render memory pressure of a fold burst, or
        // VirtualDisplay exhaustion). Without this the surface stays on the
        // stale/previous frame until the user nudges a setting; with it the
        // surface self-heals once the GL context pool clears. Reset on success.
        private var renderRetries = 0
        private val maxRenderRetries = 4
        private val refreshIntervalMs = 10L * 60 * 1000
        // B3 — wall-clock of the last SUCCESSFUL render. The 10-min refreshRunnable
        // only runs while visible, so a lock surface shown seconds at a time never
        // fires it; unchanged params+dims then repaint the cached bitmap forever
        // (positions go stale by days). On becoming visible we also render when this
        // is older than refreshIntervalMs — at most one render per unlock, only when
        // stale. Stamped ONLY on success (mirrors lastParams) so a null render still
        // retries. 0 = never rendered yet.
        private var lastSuccessfulRenderWallMs = 0L
        // C2 — single-threaded background executor for the WebP disk-cache encode
        // (~100-400 ms for a full-screen bitmap) so it never stalls the shared main
        // thread. Single thread serialises writes to the same per-dimension file so
        // two quick renders can't interleave-corrupt it. Shut down in onDestroy.
        private val diskExecutor = Executors.newSingleThreadExecutor()
        // Coalesce a burst of onSurfaceChanged events (a fold/rotation fires
        // several within ~300ms) into one render. Each render is a heavy
        // (2-12s, >1GB) off-screen WebView pass; one per intermediate size
        // starves the foreground app of CPU/memory.
        private val renderDebounceMs = 400L
        private val renderRunnable = Runnable { renderAndPaint() }
        private fun scheduleRender() {
            handler.removeCallbacks(renderRunnable)
            handler.postDelayed(renderRunnable, renderDebounceMs)
        }

        private val refreshRunnable = object : Runnable {
            override fun run() {
                renderAndPaint()
                if (visible) handler.postDelayed(this, refreshIntervalMs)
            }
        }

        // Fold-refresh: DisplayManager.DisplayListener with debounce.
        // A single fold/unfold fires displayAdded + displayChanged +
        // displayChanged… (5-7 events within ~200ms). Without debounce the
        // listener enqueues a widget refresh per event, fans out N concurrent
        // renders, exhausts the system VirtualDisplay budget, and crashes with
        // 'createVirtualDisplay returned null'. Collapsing all events within a
        // 500ms quiet window into a single trigger stays inside the resource
        // limits.
        // ownsFoldRefresh(): only the home service registers, so we don't fire
        // twice per display event when both home and lock services are bound.
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
            // No engine re-render here: onSurfaceChanged fires anyway when the
            // surface dimensions actually change after a fold. Calling
            // renderAndPaint from this runnable would pile a second WebView
            // render onto the surface-changed one and feed the white/black
            // flicker loop.
        }
        // Our own virtual displays are named "SolarRenderer-<nanoTime>" by
        // WebViewBitmapRenderer.render and are added/removed every render
        // cycle. If the listener reacts to those events it forms a feedback
        // loop: render -> VD added -> fold-refresh trigger -> renderAndPaint
        // -> render -> VD added -> ... (the white/black flicker, stuck on the
        // loading screen). Track which display IDs are ours so we can ignore
        // them.
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
                // Newest per-dimension cache as a first-paint after a process
                // restart. The exact-size match happens in onSurfaceChanged once
                // the surface dims are known; this is only the pre-surface stand-in.
                val dir = applicationContext.filesDir
                val newest = dir.listFiles { f ->
                    f.name.startsWith("wallpaper_${namespace()}_") && f.name.endsWith(".webp")
                }?.maxByOrNull { it.lastModified() }
                if (newest != null && newest.exists()) {
                    lastBitmap = android.graphics.BitmapFactory.decodeFile(newest.absolutePath)
                }
            } catch (_: Throwable) { /* best-effort; cache miss falls back to default */ }
        }

        // Per-surface-dimension cache file. Keying by dims means a fold to a size
        // we've rendered before can paint the CORRECT-framed bitmap instantly,
        // instead of cover-scaling the previous fold's bitmap (the transient
        // "way too zoomed in" until the ~3 s WebView render finishes).
        private fun diskCacheFile(w: Int, h: Int) =
            java.io.File(applicationContext.filesDir, "wallpaper_${namespace()}_${w}x${h}.webp")

        override fun onSurfaceChanged(holder: SurfaceHolder?, format: Int, w: Int, h: Int) {
            super.onSurfaceChanged(holder, format, w, h)
            widthPx = w; heightPx = h
            // Instant correct-framing paint from the per-dimension cache (if this
            // surface size was rendered before) so a fold shows the right framing
            // immediately. The fresh render below then updates planet positions.
            try {
                val f = diskCacheFile(w, h)
                if (f.exists()) {
                    val cached = android.graphics.BitmapFactory.decodeFile(f.absolutePath)
                    if (cached != null) { lastBitmap = cached; paintToSurface(cached) }
                }
            } catch (_: Throwable) { /* best-effort; fall through to render */ }
            // Only spend a heavy render when actually visible; while hidden the
            // cache paint above keeps the surface correct and onVisibilityChanged
            // renders fresh when shown. Debounced so a fold/rotation burst of
            // size changes collapses into a single render.
            if (visible) scheduleRender()
        }

        override fun onVisibilityChanged(v: Boolean) {
            super.onVisibilityChanged(v)
            visible = v
            if (v) {
                // Render fresh if params changed (offset/labels) OR the surface
                // resized while hidden (a fold/rotation we deferred). Otherwise
                // re-paint the cached bitmap — no wasted render.
                val current = currentParams()
                // B3 — also refresh when the last successful render is older than the
                // refresh interval (the lock surface is visible too briefly for the
                // 10-min timer to ever fire). Paint the cached frame FIRST so the
                // surface is instant, then render async in the background.
                val stale = lastSuccessfulRenderWallMs == 0L ||
                    (System.currentTimeMillis() - lastSuccessfulRenderWallMs) > refreshIntervalMs
                if (current != lastParams || widthPx != lastRenderW || heightPx != lastRenderH) {
                    renderAndPaint()
                } else if (stale) {
                    paintToSurface(lastBitmap)
                    renderAndPaint()
                } else {
                    paintToSurface(lastBitmap)
                }
                handler.removeCallbacks(refreshRunnable)
                handler.postDelayed(refreshRunnable, refreshIntervalMs)
            } else {
                handler.removeCallbacks(refreshRunnable)
                handler.removeCallbacks(renderRunnable)
            }
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder?) {
            super.onSurfaceDestroyed(holder)
            handler.removeCallbacks(refreshRunnable)
            handler.removeCallbacks(renderRunnable)
        }

        override fun onDestroy() {
            handler.removeCallbacks(refreshRunnable)
            handler.removeCallbacks(renderRunnable)
            handler.removeCallbacks(foldRefreshRunnable)
            if (ownsFoldRefresh()) {
                try { displayManager.unregisterDisplayListener(displayListener) } catch (_: Throwable) {}
            }
            lastBitmap = null
            diskExecutor.shutdown()
            super.onDestroy()
        }

        private fun currentParams(): String =
            SurfaceSettings(applicationContext, namespace(), defaultOffsetY()).urlParams("wallpaper")

        // SLSS_DIAG_TEMPORARY — last successful render wall-clock for throttle diag.
        private var slssLastRenderTs = 0L

        private fun renderAndPaint() {
            if (widthPx <= 0 || heightPx <= 0 || rendering) return
            rendering = true
            // Capture the dims this render is for. If the surface changes size
            // while the async WebView render is in flight, the completed bitmap
            // is sized for the old surface — painting it 1:1 on the new surface
            // would put the solar system off-corner. Compare against the live
            // widthPx/heightPx on completion and re-render.
            val rw = widthPx; val rh = heightPx
            val params = currentParams()
            val sKind = surfaceKind()
            val corr = SlssLogger.newCorrelationId()
            if (SlssLogger.enabled) {
                SlssLogger.logEvent(
                    "wallpaper_render",
                    mapOf(
                        "stage" to "engine_render_start",
                        "surface" to sKind,
                        "service_class" to this@SolarSystemWallpaperService.javaClass.simpleName,
                        "engine_visible" to visible,
                        "engine_preview" to isPreview,
                        "surface_holder_dims_px" to mapOf("w" to widthPx, "h" to heightPx),
                        "throttle_state" to mapOf(
                            "last_render_ts_ms" to slssLastRenderTs,
                            "ms_since_last" to if (slssLastRenderTs > 0) System.currentTimeMillis() - slssLastRenderTs else -1L
                        )
                    ),
                    correlationId = corr
                )
                SlssMetrics.snapshotMemoryAsync("pre_wallpaper_render")
            }
            slssLastRenderTs = System.currentTimeMillis()
            WebViewBitmapRenderer.render(applicationContext, rw, rh, params, sKind, corr) { bm ->
                rendering = false
                if (SlssLogger.enabled) {
                    val c = SlssCentroidProbe.measure(bm)
                    SlssLogger.logEvent(
                        "wallpaper_render",
                        mapOf(
                            "stage" to "post_compose_centroid",
                            "surface" to sKind,
                            "bitmap_null" to (bm == null),
                            "post_compose_centroid" to c?.toMap()
                        ),
                        correlationId = corr
                    )
                    if (c != null) {
                        SlssSyntheticEventDetector.noteWallpaperRender(
                            sKind, c.offsetXPct, c.offsetYPct, corr
                        )
                    }
                    SlssMetrics.snapshotMemoryAsync("post_wallpaper_render")
                }
                if (bm != null) {
                    renderRetries = 0
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
                    lastRenderW = rw; lastRenderH = rh
                    lastSuccessfulRenderWallMs = System.currentTimeMillis()
                    paintToSurface(bm)
                    cacheBitmapToDisk(bm, rw, rh)
                    // Surface resized mid-render (fold / reconnect display
                    // churn): this bitmap is for the old dims. paintToSurface
                    // cover-scaled it so it's centred (not off-corner), but a
                    // crisp 1:1 render for the new dims is needed — re-render.
                    if (widthPx != rw || heightPx != rh) renderAndPaint()
                } else if (visible && renderRetries < maxRenderRetries) {
                    // No bitmap (lost GL context / VD exhaustion). Back off and
                    // retry so the surface self-heals once the context pool
                    // clears, instead of leaving a stale/partial frame. Backoff
                    // grows (0.6s, 1.2s, 1.8s, 2.4s) to let the burst drain.
                    renderRetries++
                    handler.postDelayed({ if (visible) renderAndPaint() }, 600L * renderRetries)
                }
            }
        }

        // Persist the most recent successful render to filesDir so the next
        // process start (after force-stop / OOM kill / reboot) can show it
        // immediately on Engine.onCreate. WebP at quality 80 keeps the file
        // ~150-300 KB on a typical inner-display render. Encoded on a single
        // background thread (C2) so the ~100-400 ms compress never stalls the
        // shared main thread; single-threaded so same-file writes can't interleave.
        private fun cacheBitmapToDisk(bm: Bitmap, w: Int, h: Int) {
            diskExecutor.execute {
                try {
                    diskCacheFile(w, h).outputStream().use { os ->
                        @Suppress("DEPRECATION")
                        bm.compress(Bitmap.CompressFormat.WEBP, 80, os)
                    }
                } catch (_: Throwable) { /* best-effort; cache miss is acceptable */ }
            }
        }

        private fun paintToSurface(bm: Bitmap?) {
            val holder = surfaceHolder ?: return
            if (!holder.surface.isValid) return
            // Dimension-aware paint: if the bitmap was rendered for a DIFFERENT
            // surface size than the one we're about to draw on (fold state changed
            // while the screen was off — on wake the engine's widthPx/heightPx can
            // lag the real surface), prefer the correct-framed per-dimension disk
            // cache over scaling the wrong-size bitmap (the transient "zoomed in
            // then resized" wake flash). One ~20-80 ms decode of a ~150-300 KB
            // WebP, only on this rare mismatch path — the same decode that
            // onCreate/onSurfaceChanged already perform. Decoded BEFORE locking
            // the canvas so the surface lock is never held through disk I/O.
            var toDraw = bm
            val fw = holder.surfaceFrame.width()
            val fh = holder.surfaceFrame.height()
            if (toDraw != null && fw > 0 && fh > 0 && (toDraw.width != fw || toDraw.height != fh)) {
                var cacheHit = false
                try {
                    val f = diskCacheFile(fw, fh)
                    if (f.exists()) {
                        val cached = android.graphics.BitmapFactory.decodeFile(f.absolutePath)
                        if (cached != null && cached.width == fw && cached.height == fh) {
                            toDraw = cached
                            lastBitmap = cached   // keep the repaint cache consistent with the surface
                            cacheHit = true
                        }
                    }
                } catch (_: Throwable) { /* fall through to letterboxed draw */ }
                // SLSS_DIAG_TEMPORARY — record every dimension-mismatch paint and
                // whether the per-dimension cache rescued it (wake-zoom diagnosis).
                if (SlssLogger.enabled) {
                    SlssLogger.logEvent(
                        "wallpaper_render",
                        mapOf(
                            "stage" to "paint_dim_mismatch",
                            "surface" to surfaceKind(),
                            "bitmap_dims_px" to mapOf("w" to (bm?.width ?: 0), "h" to (bm?.height ?: 0)),
                            "surface_frame_px" to mapOf("w" to fw, "h" to fh),
                            "per_dim_cache_hit" to cacheHit
                        )
                    )
                }
            }
            var canvas: Canvas? = null
            try {
                canvas = holder.lockCanvas() ?: return
                canvas.drawColor(Color.BLACK)
                if (toDraw != null) {
                    val sw = canvas.width.toFloat(); val sh = canvas.height.toFloat()
                    val bw = toDraw.width.toFloat(); val bh = toDraw.height.toFloat()
                    if (bw == sw && bh == sh) {
                        // Exact match (the normal case): 1:1 blit, no scaling.
                        canvas.drawBitmap(toDraw, 0f, 0f, null)
                    } else {
                        // Dimension mismatch with no cached frame for this size:
                        // CONTAIN-scale — fit inside, centred, letterboxed. The
                        // scene is a solar system on pure black, so the bars are
                        // invisible; a briefly-smaller frame reads far better than
                        // the old COVER zoom-crop (the "zoomed in" wake flash).
                        val scale = min(sw / bw, sh / bh)
                        val dw = bw * scale; val dh = bh * scale
                        val left = (sw - dw) / 2f; val top = (sh - dh) / 2f
                        canvas.drawBitmap(toDraw, null, RectF(left, top, left + dw, top + dh), null)
                    }
                }
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
    override fun surfaceKind() = "lock"
}
