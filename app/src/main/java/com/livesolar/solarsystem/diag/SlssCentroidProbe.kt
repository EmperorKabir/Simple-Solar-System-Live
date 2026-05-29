// SLSS_DIAG_TEMPORARY — in-process centroid/bbox probe.
// Kotlin port of tools/diag/measure-centroid.mjs (plan §4.2, §4.3, §6).
// Measures orbital-ring centroid + bounding box of a rendered Bitmap so the
// widget L/R asymmetry and the lock-screen shift can be quantified in-process,
// without pulling PNGs. Remove with the rest of the diag/ package
// (grep -r SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem.diag

import android.graphics.Bitmap

internal object SlssCentroidProbe {

    // Ring pixels: faint rim of a stroked orbit. Excludes Sun (full bright) and
    // dark sky (full dark). Matches measure-centroid.mjs thresholds exactly.
    private const val RING_LUMA_MIN = 60.0
    private const val RING_LUMA_MAX = 230.0

    data class Result(
        val bitmapW: Int,
        val bitmapH: Int,
        val ringPixels: Int,
        val centroidX: Int,
        val centroidY: Int,
        val offsetXPct: Double,
        val offsetYPct: Double,
        val bboxX: Int,
        val bboxY: Int,
        val bboxW: Int,
        val bboxH: Int,
        val bboxAspect: Double,
        val leftPct: Double,
        val rightPct: Double,
        val topPct: Double,
        val bottomPct: Double,
    ) {
        fun toMap(): Map<String, Any?> = mapOf(
            "bitmap_w" to bitmapW,
            "bitmap_h" to bitmapH,
            "ring_pixel_count" to ringPixels,
            "centroid_x" to centroidX,
            "centroid_y" to centroidY,
            "x_pct" to offsetXPct,
            "y_pct" to offsetYPct,
            "bbox_x" to bboxX,
            "bbox_y" to bboxY,
            "bbox_w" to bboxW,
            "bbox_h" to bboxH,
            "bbox_aspect" to bboxAspect,
            "L_pct" to leftPct,
            "R_pct" to rightPct,
            "T_pct" to topPct,
            "B_pct" to bottomPct
        )
    }

    /**
     * Measure the ring centroid + extents. Returns null on an empty/invalid
     * bitmap. Iterates every pixel (up to ~4M at 2048²) — acceptable for a
     * diagnostic build, called once per render.
     */
    fun measure(bm: Bitmap?): Result? {
        if (bm == null || bm.width <= 0 || bm.height <= 0) return null
        val w = bm.width
        val h = bm.height
        val pixels = IntArray(w * h)
        try {
            bm.getPixels(pixels, 0, w, 0, 0, w, h)
        } catch (_: Throwable) {
            return null
        }
        var sumX = 0.0
        var sumY = 0.0
        var count = 0
        var minX = w
        var maxX = -1
        var minY = h
        var maxY = -1
        for (y in 0 until h) {
            val row = y * w
            for (x in 0 until w) {
                val p = pixels[row + x]
                val r = (p shr 16) and 0xFF
                val g = (p shr 8) and 0xFF
                val b = p and 0xFF
                val luma = 0.299 * r + 0.587 * g + 0.114 * b
                if (luma in RING_LUMA_MIN..RING_LUMA_MAX) {
                    sumX += x
                    sumY += y
                    count++
                    if (x < minX) minX = x
                    if (x > maxX) maxX = x
                    if (y < minY) minY = y
                    if (y > maxY) maxY = y
                }
            }
        }
        val cx = if (count > 0) sumX / count else w / 2.0
        val cy = if (count > 0) sumY / count else h / 2.0
        val bboxW = if (maxX >= 0) maxX - minX + 1 else 0
        val bboxH = if (maxY >= 0) maxY - minY + 1 else 0
        val halfW = w / 2.0
        val halfH = h / 2.0
        return Result(
            bitmapW = w,
            bitmapH = h,
            ringPixels = count,
            centroidX = Math.round(cx).toInt(),
            centroidY = Math.round(cy).toInt(),
            offsetXPct = round2((cx - halfW) / w * 100.0),
            offsetYPct = round2((cy - halfH) / h * 100.0),
            bboxX = if (minX <= w) minX else 0,
            bboxY = if (minY <= h) minY else 0,
            bboxW = bboxW,
            bboxH = bboxH,
            bboxAspect = if (bboxH > 0) round3(bboxW.toDouble() / bboxH) else 0.0,
            leftPct = round1((halfW - minX) / halfW * 100.0),
            rightPct = round1((maxX - halfW) / halfW * 100.0),
            topPct = round1((halfH - minY) / halfH * 100.0),
            bottomPct = round1((maxY - halfH) / halfH * 100.0)
        )
    }

    private fun round1(v: Double) = Math.round(v * 10.0) / 10.0
    private fun round2(v: Double) = Math.round(v * 100.0) / 100.0
    private fun round3(v: Double) = Math.round(v * 1000.0) / 1000.0
}
