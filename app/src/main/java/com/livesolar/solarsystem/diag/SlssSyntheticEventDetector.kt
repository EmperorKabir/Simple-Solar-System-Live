// SLSS_DIAG_TEMPORARY — synthetic higher-level event detector.
// Part of the temporary diagnostic logging system (plan §3.16, §4.4).
// Correlates raw display/device-state/screen events into a single
// `fold_unfold` summary. (lock_shift_observation, which needs centroid data,
// is added in Phase L3.) Remove with the rest of the diag/ package
// (grep -r SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem.diag

import android.os.SystemClock

internal object SlssSyntheticEventDetector {

    // Relative area change between two display geometries that we treat as a
    // genuine fold/unfold rather than a rotation or minor reconfiguration.
    private const val FOLD_AREA_RATIO = 0.30

    private val lock = Any()
    private var lastArea: Long = 0L
    private var lastW: Int = 0
    private var lastH: Int = 0
    private var lastDeviceStateId: Int = Int.MIN_VALUE
    private var lastHingeAngle: Float = Float.NaN

    // Ring of recent child-event labels for correlation (label -> mono ms).
    private val recent = ArrayDeque<Pair<String, Long>>()

    // Per-surface baseline centroid offset (surface -> [xPct, yPct]) for the
    // lock-screen-shift detector (plan §3.17). Updated on stable renders.
    private val baselines = HashMap<String, DoubleArray>()

    // Drift (in % of bitmap dimension) past which a post-trigger render is
    // flagged as a lock-screen shift.
    private const val SHIFT_DRIFT_PCT = 5.0
    // Window after a screen-on / fold within which a render is "preceded by" it.
    private const val SHIFT_WINDOW_MS = 2000L

    fun noteChild(label: String) {
        synchronized(lock) {
            recent.addLast(label to SystemClock.elapsedRealtime())
            while (recent.size > 32) recent.removeFirst()
        }
    }

    fun noteDeviceState(id: Int) {
        synchronized(lock) { lastDeviceStateId = id }
        noteChild("device_state_$id")
    }

    fun noteHingeAngle(angle: Float) {
        synchronized(lock) { lastHingeAngle = angle }
    }

    /**
     * Feed the primary display's real size. If the area changes by more than
     * [FOLD_AREA_RATIO] versus the last observation, emit a `fold_unfold`
     * synthetic event. Called from the DisplayListener for the default display.
     */
    fun noteDisplayGeometry(w: Int, h: Int) {
        if (w <= 0 || h <= 0) return
        val area = w.toLong() * h.toLong()
        val prevArea: Long
        val prevW: Int
        val prevH: Int
        val deviceState: Int
        val hinge: Float
        synchronized(lock) {
            prevArea = lastArea
            prevW = lastW
            prevH = lastH
            deviceState = lastDeviceStateId
            hinge = lastHingeAngle
            lastArea = area
            lastW = w
            lastH = h
        }
        if (prevArea <= 0L) return // first observation; nothing to compare
        if (area == prevArea) return
        val ratio = kotlin.math.abs(area - prevArea).toDouble() / maxOf(area, prevArea).toDouble()
        if (ratio < FOLD_AREA_RATIO) return // rotation / minor reconfig, not a fold

        val direction = if (area > prevArea) "unfold" else "fold"
        noteChild("fold_unfold")
        val now = SystemClock.elapsedRealtime()
        val window = synchronized(lock) {
            recent.filter { now - it.second <= 1500L }.map { it.first }
        }
        SlssLogger.logEvent(
            "fold_unfold",
            mapOf(
                "direction" to direction,
                "previous_state" to inferState(prevArea, area, invert = true),
                "new_state" to inferState(prevArea, area, invert = false),
                "previous_display_size_px" to mapOf("w" to prevW, "h" to prevH),
                "new_display_size_px" to mapOf("w" to w, "h" to h),
                "area_ratio_change" to ratio,
                "device_state_id" to if (deviceState == Int.MIN_VALUE) null else deviceState,
                "hinge_angle_deg" to if (hinge.isNaN()) null else hinge,
                "child_events_correlated" to window
            )
        )
    }

    /**
     * Feed a wallpaper render's centroid offset. Emits lock_shift_observation
     * (plan §3.17) when this render was preceded (within [SHIFT_WINDOW_MS]) by a
     * screen-on / fold / unfold AND the centroid drifted past [SHIFT_DRIFT_PCT]
     * from the surface's stable baseline. Baseline is (re)seeded on stable
     * (non-triggered) renders.
     */
    fun noteWallpaperRender(surface: String, xPct: Double, yPct: Double, correlationId: String?) {
        val now = SystemClock.elapsedRealtime()
        val triggers = synchronized(lock) {
            recent.filter {
                now - it.second <= SHIFT_WINDOW_MS && (
                    it.first.startsWith("screen_SCREEN_ON") ||
                        it.first == "screen_USER_PRESENT" ||
                        it.first == "fold_unfold"
                    )
            }.map { it.first }
        }
        val base = synchronized(lock) { baselines[surface]?.copyOf() }
        if (base != null && triggers.isNotEmpty()) {
            val driftX = xPct - base[0]
            val driftY = yPct - base[1]
            if (kotlin.math.abs(driftX) > SHIFT_DRIFT_PCT || kotlin.math.abs(driftY) > SHIFT_DRIFT_PCT) {
                SlssLogger.logEvent(
                    "lock_shift_observation",
                    mapOf(
                        "surface" to surface,
                        "preceded_by" to triggers,
                        "baseline_centroid_x_pct" to base[0],
                        "baseline_centroid_y_pct" to base[1],
                        "current_centroid_x_pct" to xPct,
                        "current_centroid_y_pct" to yPct,
                        "centroid_drift_x_pct" to driftX,
                        "centroid_drift_y_pct" to driftY
                    ),
                    correlationId = correlationId
                )
            }
        }
        // Seed/refresh baseline on a stable render (no recent trigger), or first time.
        if (triggers.isEmpty() || base == null) {
            synchronized(lock) { baselines[surface] = doubleArrayOf(xPct, yPct) }
        }
    }

    private fun inferState(prevArea: Long, newArea: Long, invert: Boolean): String {
        // The larger-area geometry is the unfolded (inner) screen.
        val unfoldingNow = newArea > prevArea
        val openState = if (invert) !unfoldingNow else unfoldingNow
        return if (openState) "OPENED" else "CLOSED"
    }
}
